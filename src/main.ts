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
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDateKey: string | null = null;

function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPracticeDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function getMissionById(missionId: string): Mission | null {
  return state.missions.find((mission) => mission.id === missionId) ?? null;
}

function buildDailyPracticeMap(): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  state.history.forEach((entry) => {
    const key = toDateKey(entry.time);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  });
  return map;
}

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
    .map((mission) => {
      const isPracticed = mission.lastPracticedAt !== null;
      const dateLabel =
        mission.lastPracticedAt !== null ? formatPracticeDate(mission.lastPracticedAt) : "未練習";
      const statusLabel = mission.current >= mission.count ? "完了" : isPracticed ? "練習済み" : "未練習";
      const cardClass = isPracticed ? "mission-card mission-card--practiced" : "mission-card mission-card--new";

      return `
        <button type="button" class="${cardClass}" data-mission-id="${mission.id}">
          <span class="mission-main">
            <span class="mission-title">${mission.title}</span>
            <span class="mission-date">最終練習日: ${dateLabel}</span>
          </span>
          <span class="mission-status">${statusLabel}</span>
        </button>
      `;
    })
    .join("");
}

function renderHistory(): void {
  const items = state.history.slice(0, 12);

  dom.historyGrid.innerHTML = items
    .map((entry, index) => {
      const mission = getMissionById(entry.missionId);
      const missionTitle = mission ? mission.title : "不明な課題";
      const doneAt = `${formatPracticeDate(entry.time)} ${formatTime(entry.time)}`;

      return `
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
          <p class="history-detail">${doneAt} / ${missionTitle}</p>
        </article>
      `;
    })
    .join("");
}

function renderCalendarLog(entries: HistoryEntry[]): void {
  if (entries.length === 0) {
    dom.calendarLogList.innerHTML = '<li class="calendar-log-empty">この日の練習記録はありません</li>';
    return;
  }

  dom.calendarLogList.innerHTML = entries
    .map((entry) => {
      const mission = getMissionById(entry.missionId);
      const missionTitle = mission ? mission.title : "不明な課題";
      return `<li class="calendar-log-item">${formatTime(entry.time)} / ${missionTitle}（${entry.char}）</li>`;
    })
    .join("");
}

function renderCalendar(): void {
  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dailyMap = buildDailyPracticeMap();

  dom.calendarLabel.textContent = `${y}年${m + 1}月`;

  const practicedInMonth: string[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toDateKey(new Date(y, m, day).getTime());
    if ((dailyMap.get(key) ?? []).length > 0) {
      practicedInMonth.push(key);
    }
  }

  if (!selectedCalendarDateKey || !selectedCalendarDateKey.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)) {
    selectedCalendarDateKey = practicedInMonth[0] ?? toDateKey(new Date(y, m, 1).getTime());
  }

  const cells: string[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="calendar-day calendar-day--blank"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(y, m, day);
    const key = toDateKey(date.getTime());
    const entries = dailyMap.get(key) ?? [];
    const practicedClass = entries.length > 0 ? "calendar-day--practiced" : "calendar-day--empty";
    const selectedClass = key === selectedCalendarDateKey ? "calendar-day--selected" : "";

    cells.push(`
      <button type="button" class="calendar-day ${practicedClass} ${selectedClass}" data-date-key="${key}">
        <span class="calendar-day-num">${day}</span>
        <span class="calendar-day-count">${entries.length > 0 ? `${entries.length}件` : ""}</span>
      </button>
    `);
  }

  dom.calendarGrid.innerHTML = cells.join("");

  const selectedEntries = selectedCalendarDateKey ? dailyMap.get(selectedCalendarDateKey) ?? [] : [];
  dom.calendarLogDate.textContent = selectedCalendarDateKey
    ? selectedCalendarDateKey.replace(/-/g, "/")
    : "日付を選んでください";
  renderCalendarLog(selectedEntries);
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
  writingCanvas.clearGuide();
  updateStrokeBadge();
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
  writingCanvas.clearGuide();
  updateStrokeBadge();
}

function handleNextChar(): void {
  const mission = getActiveMission();
  if (!mission) return;
  if (state.active.strokes.length === 0) return;

  const currentChar = getActiveChar();
  const practicedAt = Date.now();

  const historyEntry: HistoryEntry = {
    missionId: mission.id,
    char: currentChar,
    img: writingCanvas.toDataUrl(),
    data: state.active.strokes.map((stroke) => [...stroke]),
    time: practicedAt,
  };

  mission.lastPracticedAt = practicedAt;
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
  renderCalendar();
  celebrateMissionDone();
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
  renderCalendar();
  router.renderView("home");
}

function playCelebrateSound(): void {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const audioContext = new AudioContextCtor();
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    const start = audioContext.currentTime + index * 0.12;
    const end = start + 0.22;
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(start);
    osc.stop(end);
  });
}

function celebrateMissionDone(): void {
  dom.celebrateStamp.classList.remove("hidden");
  playCelebrateSound();
  window.setTimeout(() => {
    dom.celebrateStamp.classList.add("hidden");
  }, 1800);
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
    renderCalendar();
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

  dom.calendarPrevButton.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    selectedCalendarDateKey = null;
    renderCalendar();
  });

  dom.calendarNextButton.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    selectedCalendarDateKey = null;
    renderCalendar();
  });

  dom.calendarGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const day = target.closest<HTMLElement>("[data-date-key]");
    const dateKey = day?.dataset.dateKey;
    if (!dateKey) return;

    selectedCalendarDateKey = dateKey;
    renderCalendar();
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
    },
  });
}

function init(): void {
  bindEvents();
  renderContentList();
  renderMissions();
  renderHistory();
  renderCalendar();
  updateStrokeBadge();
  router.renderView("portal");
}

init();
