const GAME_SECONDS = 30;
const COUNTDOWN_SECONDS = 3;
const MAX_BALLOONS = 4;
const SPAWN_INTERVAL_MS = 780;
const MEDIAPIPE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";
const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type Landmark = { x: number; y: number; z?: number };
type HandResult = { landmarks?: Landmark[][] };
type HandLandmarkerLike = {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): HandResult;
  close(): void;
};
type VisionModule = {
  FilesetResolver: {
    forVisionTasks(baseUrl: string): Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions(
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: "GPU" | "CPU" };
        runningMode: "VIDEO";
        numHands: number;
        minHandDetectionConfidence: number;
        minHandPresenceConfidence: number;
        minTrackingConfidence: number;
      },
    ): Promise<HandLandmarkerLike>;
  };
};

type BalloonRecord = {
  element: HTMLDivElement;
  bornAt: number;
};

type HandPoint = {
  x: number;
  y: number;
  radius: number;
};

const video = document.querySelector<HTMLVideoElement>("#camera")!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const balloonLayer = document.querySelector<HTMLElement>("#balloon-layer")!;
const effects = document.querySelector<HTMLElement>("#effects")!;
const handLayer = document.querySelector<HTMLElement>("#hand-layer")!;
const handStatus = document.querySelector<HTMLElement>("#hand-status")!;
const scoreElement = document.querySelector<HTMLElement>("#score")!;
const timeElement = document.querySelector<HTMLElement>("#time")!;
const timerElement = document.querySelector<HTMLElement>(".timer")!;
const startPanel = document.querySelector<HTMLElement>("#start-panel")!;
const countdownPanel = document.querySelector<HTMLElement>("#countdown-panel")!;
const countdownNumber = document.querySelector<HTMLElement>("#countdown-number")!;
const resultPanel = document.querySelector<HTMLElement>("#result-panel")!;
const resultScore = document.querySelector<HTMLElement>("#result-score")!;
const errorPanel = document.querySelector<HTMLElement>("#error-panel")!;
const errorMessage = document.querySelector<HTMLElement>("#error-message")!;
const startButton = document.querySelector<HTMLButtonElement>("#start-button")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry-button")!;
const retryCameraButton = document.querySelector<HTMLButtonElement>("#retry-camera-button")!;

let stream: MediaStream | null = null;
let handLandmarker: HandLandmarkerLike | null = null;
let animationId = 0;
let spawnTimer = 0;
let gameTimer = 0;
let score = 0;
let running = false;
let audioContext: AudioContext | null = null;
let lastVideoTime = -1;
const balloons: BalloonRecord[] = [];
const handMarkers = Array.from({ length: 2 }, (_, index) => {
  const marker = document.createElement("div");
  marker.className = "hand-marker";
  marker.dataset.handIndex = String(index);
  marker.innerHTML = '<span class="hand-marker-icon">✋</span>';
  marker.hidden = true;
  handLayer.append(marker);
  return marker;
});

function setPanel(panel: HTMLElement | null): void {
  [startPanel, countdownPanel, resultPanel, errorPanel].forEach((item) => item.classList.toggle("hidden", item !== panel));
}

function ensureAudio(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

function playPopSound(): void {
  const audio = ensureAudio();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(120, audio.currentTime + 0.12);
  gain.gain.setValueAtTime(0.18, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.14);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.15);
}

function playFinishSound(): void {
  const audio = ensureAudio();
  [523, 659, 784].forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, audio.currentTime + index * 0.12);
    gain.gain.linearRampToValueAtTime(0.15, audio.currentTime + index * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + index * 0.12 + 0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + index * 0.12);
    oscillator.stop(audio.currentTime + index * 0.12 + 0.27);
  });
}

async function prepareHandTracker(): Promise<void> {
  if (handLandmarker) return;
  handStatus.textContent = "✋ てを さがしています";
  const visionModule = (await import(/* @vite-ignore */ MEDIAPIPE_MODULE_URL)) as unknown as VisionModule;
  const fileset = await visionModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  try {
    handLandmarker = await visionModule.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
  } catch {
    handLandmarker = await visionModule.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
  }
}

async function prepareCamera(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザはカメラ機能に対応していません。");
  }
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  }
  await prepareHandTracker();
}

function clearBalloons(): void {
  balloons.splice(0).forEach(({ element }) => element.remove());
  effects.replaceChildren();
}

function hideHandMarkers(): void {
  handMarkers.forEach((marker) => {
    marker.hidden = true;
    marker.classList.remove("is-touching");
  });
  handStatus.textContent = "✋ てを みせてね";
}

function createBalloon(): void {
  if (!running || balloons.length >= MAX_BALLOONS) return;
  const rect = stage.getBoundingClientRect();
  const size = Math.min(Math.max(rect.width * (rect.width < 500 ? 0.24 : 0.17), 86), 150);
  const safeTop = 18;
  const safeBottom = 62;
  const x = Math.random() * Math.max(1, rect.width - size - 16) + 8;
  const y = Math.random() * Math.max(1, rect.height - size - safeTop - safeBottom) + safeTop;
  const colors = ["red", "blue", "yellow", "green", "purple"];
  const balloon = document.createElement("div");
  balloon.className = `balloon ${colors[Math.floor(Math.random() * colors.length)]}`;
  balloon.style.left = `${x}px`;
  balloon.style.top = `${y}px`;
  balloon.style.width = `${size}px`;
  balloon.style.animationDelay = `${Math.random() * -2}s`;
  balloon.textContent = "✨";
  balloonLayer.append(balloon);
  balloons.push({ element: balloon, bornAt: performance.now() });
}

function popBalloon(record: BalloonRecord): void {
  const index = balloons.indexOf(record);
  if (index < 0) return;
  balloons.splice(index, 1);
  const rect = record.element.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  record.element.remove();
  score += 1;
  scoreElement.textContent = String(score);
  const effect = document.createElement("div");
  effect.className = "pop";
  effect.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
  effect.style.top = `${rect.top - stageRect.top + rect.height / 2}px`;
  effect.textContent = score % 10 === 0 ? "🎉" : "💥";
  effects.append(effect);
  window.setTimeout(() => effect.remove(), 650);
  playPopSound();
  window.setTimeout(createBalloon, 130);
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handPointFromLandmarks(landmarks: Landmark[], stageRect: DOMRect): HandPoint | null {
  if (landmarks.length < 21) return null;
  const palmIndexes = [0, 5, 9, 13, 17];
  const palm = palmIndexes.reduce(
    (total, index) => ({ x: total.x + landmarks[index].x, y: total.y + landmarks[index].y }),
    { x: 0, y: 0 },
  );
  const centerX = 1 - palm.x / palmIndexes.length;
  const centerY = palm.y / palmIndexes.length;
  const handSpan = Math.max(distance(landmarks[5], landmarks[17]), distance(landmarks[0], landmarks[9]));
  return {
    x: centerX * stageRect.width,
    y: centerY * stageRect.height,
    radius: Math.min(100, Math.max(48, handSpan * stageRect.width * 0.95)),
  };
}

function circleTouchesRect(point: HandPoint, rect: DOMRect, stageRect: DOMRect): boolean {
  const left = rect.left - stageRect.left;
  const top = rect.top - stageRect.top;
  const closestX = Math.max(left, Math.min(point.x, left + rect.width));
  const closestY = Math.max(top, Math.min(point.y, top + rect.height));
  return Math.hypot(point.x - closestX, point.y - closestY) <= point.radius;
}

function renderHands(points: HandPoint[]): void {
  const stageRect = stage.getBoundingClientRect();
  let anyTouching = false;
  points.forEach((point, index) => {
    const marker = handMarkers[index];
    marker.hidden = false;
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    marker.style.width = `${point.radius * 2}px`;
    let touching = false;
    const now = performance.now();
    for (const record of [...balloons]) {
      if (now - record.bornAt < 260) continue;
      if (circleTouchesRect(point, record.element.getBoundingClientRect(), stageRect)) {
        touching = true;
        popBalloon(record);
        break;
      }
    }
    marker.classList.toggle("is-touching", touching);
    anyTouching ||= touching;
  });
  handMarkers.slice(points.length).forEach((marker) => {
    marker.hidden = true;
    marker.classList.remove("is-touching");
  });
  handStatus.textContent = points.length > 0 ? (anyTouching ? "💥 あたった！" : `✋ てを ${points.length}こ みつけたよ`) : "✋ てを みせてね";
}

function detectHands(): void {
  if (!running || !handLandmarker) return;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    const stageRect = stage.getBoundingClientRect();
    const points = (result.landmarks ?? [])
      .map((landmarks) => handPointFromLandmarks(landmarks, stageRect))
      .filter((point): point is HandPoint => point !== null);
    renderHands(points);
  }
  animationId = requestAnimationFrame(detectHands);
}

function stopGame(): void {
  running = false;
  cancelAnimationFrame(animationId);
  window.clearInterval(spawnTimer);
  window.clearInterval(gameTimer);
  timerElement.classList.remove("is-ending");
  clearBalloons();
  hideHandMarkers();
  resultScore.textContent = String(score);
  setPanel(resultPanel);
  playFinishSound();
}

async function countdown(): Promise<void> {
  setPanel(countdownPanel);
  for (let value = COUNTDOWN_SECONDS; value >= 1; value -= 1) {
    countdownNumber.textContent = String(value);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
  }
  countdownNumber.textContent = "GO!";
  await new Promise((resolve) => window.setTimeout(resolve, 500));
}

async function startGame(): Promise<void> {
  startButton.disabled = true;
  retryButton.disabled = true;
  retryCameraButton.disabled = true;
  try {
    ensureAudio();
    await prepareCamera();
    await countdown();
    setPanel(null);
    clearBalloons();
    hideHandMarkers();
    score = 0;
    scoreElement.textContent = "0";
    timeElement.textContent = String(GAME_SECONDS);
    lastVideoTime = -1;
    running = true;
    for (let index = 0; index < 3; index += 1) createBalloon();
    spawnTimer = window.setInterval(createBalloon, SPAWN_INTERVAL_MS);
    let remaining = GAME_SECONDS;
    gameTimer = window.setInterval(() => {
      remaining -= 1;
      timeElement.textContent = String(remaining);
      timerElement.classList.toggle("is-ending", remaining <= 5);
      if (remaining <= 0) stopGame();
    }, 1000);
    animationId = requestAnimationFrame(detectHands);
  } catch (error) {
    const message = error instanceof DOMException && error.name === "NotAllowedError"
      ? "カメラが許可されていません。ブラウザの設定でカメラを許可してください。"
      : error instanceof Error
        ? `手の認識を開始できませんでした。通信状態を確認して、もう一度お試しください。(${error.message})`
        : "カメラと手の認識を開始できませんでした。";
    errorMessage.textContent = message;
    setPanel(errorPanel);
  } finally {
    startButton.disabled = false;
    retryButton.disabled = false;
    retryCameraButton.disabled = false;
  }
}

startButton.addEventListener("click", () => void startGame());
retryButton.addEventListener("click", () => void startGame());
retryCameraButton.addEventListener("click", () => {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  void startGame();
});

window.addEventListener("pagehide", () => {
  running = false;
  cancelAnimationFrame(animationId);
  window.clearInterval(spawnTimer);
  window.clearInterval(gameTimer);
  stream?.getTracks().forEach((track) => track.stop());
  handLandmarker?.close();
  handLandmarker = null;
});
