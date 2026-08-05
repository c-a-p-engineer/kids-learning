const GAME_SECONDS = 30;
const COUNTDOWN_SECONDS = 3;
const CAMERA_WIDTH = 160;
const CAMERA_HEIGHT = 120;
const MOTION_THRESHOLD = 34;
const MOTION_RATIO_TO_POP = 0.075;
const MAX_BALLOONS = 4;
const SPAWN_INTERVAL_MS = 780;

type BalloonRecord = {
  element: HTMLDivElement;
  bornAt: number;
};

const video = document.querySelector<HTMLVideoElement>("#camera")!;
const canvas = document.querySelector<HTMLCanvasElement>("#motion-canvas")!;
const context = canvas.getContext("2d", { willReadFrequently: true })!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const balloonLayer = document.querySelector<HTMLElement>("#balloon-layer")!;
const effects = document.querySelector<HTMLElement>("#effects")!;
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

canvas.width = CAMERA_WIDTH;
canvas.height = CAMERA_HEIGHT;

let stream: MediaStream | null = null;
let previousFrame: Uint8ClampedArray | null = null;
let animationId = 0;
let spawnTimer = 0;
let gameTimer = 0;
let score = 0;
let running = false;
let audioContext: AudioContext | null = null;
const balloons: BalloonRecord[] = [];

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

async function prepareCamera(): Promise<void> {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザはカメラ機能に対応していません。");
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

function clearBalloons(): void {
  balloons.splice(0).forEach(({ element }) => element.remove());
  effects.replaceChildren();
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

function motionRatioForBalloon(record: BalloonRecord, current: Uint8ClampedArray): number {
  if (!previousFrame) return 0;
  const stageRect = stage.getBoundingClientRect();
  const rect = record.element.getBoundingClientRect();
  const mirroredLeft = stageRect.right - rect.right;
  const x0 = Math.max(0, Math.floor((mirroredLeft / stageRect.width) * CAMERA_WIDTH));
  const x1 = Math.min(CAMERA_WIDTH - 1, Math.ceil(((mirroredLeft + rect.width) / stageRect.width) * CAMERA_WIDTH));
  const y0 = Math.max(0, Math.floor(((rect.top - stageRect.top) / stageRect.height) * CAMERA_HEIGHT));
  const y1 = Math.min(CAMERA_HEIGHT - 1, Math.ceil(((rect.bottom - stageRect.top) / stageRect.height) * CAMERA_HEIGHT));
  let changed = 0;
  let sampled = 0;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const index = (y * CAMERA_WIDTH + x) * 4;
      const difference = Math.abs(current[index] - previousFrame[index]) + Math.abs(current[index + 1] - previousFrame[index + 1]) + Math.abs(current[index + 2] - previousFrame[index + 2]);
      if (difference > MOTION_THRESHOLD * 3) changed += 1;
      sampled += 1;
    }
  }
  return sampled > 0 ? changed / sampled : 0;
}

function detectMotion(): void {
  if (!running) return;
  context.save();
  context.scale(-1, 1);
  context.drawImage(video, -CAMERA_WIDTH, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
  context.restore();
  const current = context.getImageData(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT).data;
  const now = performance.now();
  for (const record of [...balloons]) {
    if (now - record.bornAt > 380 && motionRatioForBalloon(record, current) >= MOTION_RATIO_TO_POP) {
      popBalloon(record);
    }
  }
  previousFrame = new Uint8ClampedArray(current);
  animationId = requestAnimationFrame(detectMotion);
}

function stopGame(): void {
  running = false;
  cancelAnimationFrame(animationId);
  window.clearInterval(spawnTimer);
  window.clearInterval(gameTimer);
  timerElement.classList.remove("is-ending");
  clearBalloons();
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
    score = 0;
    scoreElement.textContent = "0";
    timeElement.textContent = String(GAME_SECONDS);
    previousFrame = null;
    running = true;
    for (let i = 0; i < 3; i += 1) createBalloon();
    spawnTimer = window.setInterval(createBalloon, SPAWN_INTERVAL_MS);
    let remaining = GAME_SECONDS;
    gameTimer = window.setInterval(() => {
      remaining -= 1;
      timeElement.textContent = String(remaining);
      timerElement.classList.toggle("is-ending", remaining <= 5);
      if (remaining <= 0) stopGame();
    }, 1000);
    animationId = requestAnimationFrame(detectMotion);
  } catch (error) {
    const message = error instanceof DOMException && error.name === "NotAllowedError"
      ? "カメラが許可されていません。ブラウザの設定でカメラを許可してください。"
      : error instanceof Error ? error.message : "カメラを開始できませんでした。";
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
});
