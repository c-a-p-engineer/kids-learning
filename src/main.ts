import "./styles/main.scss";

import { CANVAS_SIZE, STROKE_COLORS } from "./app/constants";
import { WritingCanvas } from "./app/canvas";
import { getDom } from "./app/dom";
import { ViewRouter } from "./app/router";
import { createMission, isValidMissionWord, loadState, saveState } from "./app/store";
import type { HistoryEntry, LearningContent, Mission } from "./app/types";

const LEARNING_CONTENTS: LearningContent[] = [
  {
    id: "hirakana-master",
    title: "ひらカナマスター",
    description: "ひらがな・カタカナの手書きれんしゅう",
    tags: ["国語", "文字", "手書き"],
  },
];

const dom = getDom();
const router = new ViewRouter({
  gameTabs: dom.gameTabs,
  homeTab: dom.homeTab,
  parentTab: dom.parentTab,
  portalView: dom.portalView,
  homeView: dom.homeView,
  playView: dom.playView,
  parentView: dom.parentView,
});

const state = loadState();
const writingCanvas = new WritingCanvas(dom.drawCanvas, dom.guideCanvas);

function renderContentList(): void {
  dom.contentList.innerHTML = LEARNING_CONTENTS.map(
    (content) => `
      <button type="button" class="content-card" data-content-id="${content.id}">
        <h2 class="content-title">${content.title}</h2>
        <p class="content-description">${content.description}</p>
        <p class="content-tags">${content.tags.join(" / ")}</p>
      </button>
    `,
  ).join("");
}

function renderMissions(): void {
  dom.missionList.innerHTML = state.missions
    .map(
      (mission) => `
        <button type="button" class="mission-card" data-mission-id="${mission.id}">
          <span class="mission-title">${mission.title}</span>
          <span class="mission-status">${mission.current >= mission.count ? "完了" : "練習"}</span>
        </button>
      `,
    )
    .join("");
}

function renderHistory(): void {
  const items = state.history.slice(0, 16);

  dom.historyGrid.innerHTML = items
    .map(
      (entry, index) => `
        <article class="history-card" data-history-index="${index}">
          <div class="history-preview-wrap">
            <img src="${entry.img}" alt="${entry.char} の練習結果" class="history-preview" />
            <button type="button" class="history-action replay" data-action="replay" data-history-index="${index}">再生</button>
          </div>
          <div class="history-meta">
            <span class="history-char">${entry.char}</span>
            <div class="history-actions">
              <button type="button" class="history-action download-image" data-action="download-image" data-history-index="${index}">画像</button>
              <button type="button" class="history-action download-video" data-action="download-video" data-history-index="${index}">動画</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function getActiveMission(): Mission | null {
  if (state.active.missionIdx < 0) return null;
  return state.missions[state.active.missionIdx] ?? null;
}

function getActiveChar(): string {
  const mission = getActiveMission();
  if (!mission) return "";
  return mission.word[state.active.charIdx] ?? "";
}

function updateStrokeBadge(): void {
  const index = state.active.strokes.length;
  dom.strokeBadge.textContent = `${index + 1}画目`;
  dom.strokeBadge.style.backgroundColor = STROKE_COLORS[index % STROKE_COLORS.length];
}

function updatePlayScreen(): void {
  const mission = getActiveMission();
  if (!mission) {
    router.renderView("home");
    return;
  }

  const currentChar = getActiveChar();
  dom.targetChar.textContent = currentChar;
  dom.playTitle.textContent = mission.title;
  dom.playLap.textContent = `${state.active.lap}/${mission.count}回目`;

  state.active.strokes = [];
  state.active.currentPoints = [];
  writingCanvas.clearDrawing();
  updateStrokeBadge();
  writingCanvas.drawGuide(currentChar, state.active.strokes.length);
  speak(currentChar);
}

function startMission(missionId: string): void {
  const index = state.missions.findIndex((mission) => mission.id === missionId);
  if (index < 0) return;

  state.active.missionIdx = index;
  state.active.charIdx = 0;
  state.active.lap = 1;
  state.active.strokes = [];
  state.active.currentPoints = [];

  router.renderView("play");
  updatePlayScreen();
}

function closeReplay(): void {
  dom.replayOverlay.classList.add("hidden");
  dom.replayOverlay.setAttribute("aria-hidden", "true");
}

function openReplay(index: number): void {
  const item = state.history[index];
  if (!item) return;

  dom.replayTitle.textContent = `「${item.char}」をさいせい`;
  dom.replayOverlay.classList.remove("hidden");
  dom.replayOverlay.setAttribute("aria-hidden", "false");
  writingCanvas.replay(item, dom.replayCanvas);
}

function downloadHistoryImage(index: number): void {
  const item = state.history[index];
  if (!item) return;

  const link = document.createElement("a");
  link.download = `kana_${item.char}.png`;
  link.href = item.img;
  link.click();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getVideoMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

async function renderStrokeAnimation(
  entry: HistoryEntry,
  context: CanvasRenderingContext2D,
  scale: number,
): Promise<void> {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_SIZE * scale, CANVAS_SIZE * scale);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 14 * scale;

  for (let strokeIndex = 0; strokeIndex < entry.data.length; strokeIndex += 1) {
    const stroke = entry.data[strokeIndex];
    if (stroke.length === 0) continue;

    context.strokeStyle = STROKE_COLORS[strokeIndex % STROKE_COLORS.length];
    context.beginPath();
    context.moveTo(stroke[0].x * scale, stroke[0].y * scale);

    for (let pointIndex = 1; pointIndex < stroke.length; pointIndex += 1) {
      const point = stroke[pointIndex];
      const prev = stroke[pointIndex - 1];
      context.lineTo(point.x * scale, point.y * scale);
      context.stroke();

      const waitMs = Math.max(0, Math.min(point.t - prev.t, 50));
      await wait(waitMs);
    }

    await wait(300);
  }
}

async function downloadHistoryVideo(index: number): Promise<void> {
  const item = state.history[index];
  if (!item) return;
  if (!("MediaRecorder" in window)) return;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return;

  const stream = canvas.captureStream(30);
  const mimeType = getVideoMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const complete = new Promise<Blob>((resolve) => {
    recorder.addEventListener("stop", () => {
      resolve(new Blob(chunks, { type: mimeType }));
    });
  });

  recorder.start();
  await renderStrokeAnimation(item, context, 1);
  await wait(240);
  recorder.stop();

  const blob = await complete;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `kana_${item.char}.webm`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function clearCurrentCanvas(): void {
  state.active.strokes = [];
  state.active.currentPoints = [];
  writingCanvas.clearDrawing();
  updateStrokeBadge();

  const char = getActiveChar();
  if (char) {
    writingCanvas.drawGuide(char, state.active.strokes.length);
  }
}

function handleNextChar(): void {
  const mission = getActiveMission();
  if (!mission) return;
  if (state.active.strokes.length === 0) return;

  const currentChar = getActiveChar();

  const historyEntry: HistoryEntry = {
    char: currentChar,
    img: writingCanvas.toDataUrl(),
    data: state.active.strokes.map((stroke) => [...stroke]),
    time: Date.now(),
  };

  state.history.unshift(historyEntry);

  const isLastChar = state.active.charIdx >= mission.word.length - 1;
  if (!isLastChar) {
    state.active.charIdx += 1;
    saveState(state);
    updatePlayScreen();
    return;
  }

  const isLastLap = state.active.lap >= mission.count;
  if (!isLastLap) {
    state.active.lap += 1;
    state.active.charIdx = 0;
    saveState(state);
    updatePlayScreen();
    return;
  }

  mission.current = mission.count;
  saveState(state);
  renderMissions();
  renderHistory();
  router.renderView("home");
}

function addMission(): void {
  const word = dom.parentInput.value.trim();
  const count = Number.parseInt(dom.parentCountInput.value, 10);

  if (!word || !isValidMissionWord(word)) {
    dom.addError.textContent = "ひらがな・カタカナだけで入力してね！";
    dom.addError.classList.remove("hidden");
    return;
  }

  if (!Number.isInteger(count) || count < 1 || count > 20) {
    dom.addError.textContent = "回数は1〜20の数字で入力してね！";
    dom.addError.classList.remove("hidden");
    return;
  }

  dom.addError.classList.add("hidden");
  state.missions.unshift(createMission(word, count));
  dom.parentInput.value = "";
  dom.parentCountInput.value = "1";

  saveState(state);
  renderMissions();
  router.renderView("home");
}

function launchContent(contentId: string): void {
  if (contentId !== "hirakana-master") return;
  renderMissions();
  renderHistory();
  router.renderView("home");
}

function speak(text: string): void {
  if (!text) return;
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

function bindEvents(): void {
  dom.contentList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const card = target.closest<HTMLElement>("[data-content-id]");
    const contentId = card?.dataset.contentId;
    if (!contentId) return;

    launchContent(contentId);
  });

  dom.homeTab.addEventListener("click", () => {
    renderMissions();
    router.renderView("home");
  });

  dom.parentTab.addEventListener("click", () => {
    renderHistory();
    router.renderView("parent");
  });

  dom.backPortalButton.addEventListener("click", () => {
    closeReplay();
    router.renderView("portal");
  });

  dom.backHomeButton.addEventListener("click", () => {
    renderMissions();
    router.renderView("home");
  });

  dom.doneButton.addEventListener("click", handleNextChar);
  dom.clearButton.addEventListener("click", clearCurrentCanvas);

  dom.addMissionButton.addEventListener("click", addMission);
  dom.parentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addMission();
    }
  });
  dom.parentCountInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addMission();
    }
  });

  dom.missionList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const card = target.closest<HTMLElement>("[data-mission-id]");
    const missionId = card?.dataset.missionId;
    if (!missionId) return;

    startMission(missionId);
  });

  dom.historyGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionNode = target.closest<HTMLElement>("[data-action]");
    if (!actionNode) return;

    const index = Number(actionNode.dataset.historyIndex);
    if (!Number.isInteger(index)) return;

    const action = actionNode.dataset.action;
    if (action === "replay") {
      openReplay(index);
      return;
    }

    if (action === "download-image") {
      downloadHistoryImage(index);
      return;
    }

    if (action === "download-video") {
      void downloadHistoryVideo(index);
    }
  });

  dom.closeReplayButton.addEventListener("click", closeReplay);
  dom.replayOverlay.addEventListener("click", (event) => {
    if (event.target === dom.replayOverlay) {
      closeReplay();
    }
  });

  writingCanvas.bindInput({
    getStrokeIndex: () => state.active.strokes.length,
    onStrokeComplete: (points) => {
      state.active.strokes.push(points);
      updateStrokeBadge();
      const char = getActiveChar();
      if (char) {
        writingCanvas.drawGuide(char, state.active.strokes.length);
      }
    },
  });
}

function init(): void {
  bindEvents();
  renderContentList();
  renderMissions();
  renderHistory();
  updateStrokeBadge();
  router.renderView("portal");
}

init();
