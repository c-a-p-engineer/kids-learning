import "./styles/main.scss";

import { CANVAS_SIZE, DEFAULT_MISSIONS, STORAGE_KEYS, STROKE_COLORS } from "./app/constants";
import { WritingCanvas } from "./app/canvas";
import { getDom } from "./app/dom";
import { ViewRouter } from "./app/router";
import { createMission, isValidMissionWord, loadState, saveState } from "./app/store";
import { LEARNING_CONTENTS } from "./contents";
import { DOTBURST_CONTENT } from "./contents/dotburst";
import { DotBurstGame } from "./contents/dotburst-game";
import { FLASHCARD_CONTENT } from "./contents/flashcard";
import { FlashcardGame } from "./contents/flashcard-game";
import { LARGER_NUMBER_CONTENT } from "./contents/larger-number";
import { LargerNumberGame } from "./contents/larger-number-game";
import type { HistoryEntry, Mission, ViewId } from "./app/types";

type PortalTheme = "warm" | "cool" | "fancy" | "cyber";

function applyGithubPagesRedirectPath(): void {
  const url = new URL(window.location.href);
  const redirect = url.searchParams.get("redirect");
  if (!redirect || !redirect.startsWith("/")) return;
  window.history.replaceState(null, "", redirect);
}

applyGithubPagesRedirectPath();

const dom = getDom();
const router = new ViewRouter({
  gameTabs: dom.gameTabs,
  homeTab: dom.homeTab,
  parentTab: dom.parentTab,
  portalView: dom.portalView,
  homeView: dom.homeView,
  playView: dom.playView,
  parentView: dom.parentView,
}, LEARNING_CONTENTS.map((content) => content.id));

const state = loadState();
const writingCanvas = new WritingCanvas(dom.drawCanvas, dom.guideCanvas);
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDateKey: string | null = null;
let strokeModelRequestId = 0;
let lastStrokeModelSvg: string | null = null;
let bulkDownloadRunning = false;
let activeContentId: string | null = null;
const dotBurstGame = new DotBurstGame(dom.dotburstRoot);
const flashcardGame = new FlashcardGame(dom.flashcardRoot);
const largerNumberGame = new LargerNumberGame(dom.largerNumberRoot);
const UI_THEME_STORAGE_KEY = "ui_theme_v1";
let portalTheme: PortalTheme = loadPortalTheme();
const themeButtons: Record<PortalTheme, HTMLButtonElement> = {
  warm: dom.themeWarmButton,
  cool: dom.themeCoolButton,
  fancy: dom.themeFancyButton,
  cyber: dom.themeCyberButton,
};

const ANIM_CJK_BASE_URL = "https://cdn.jsdelivr.net/gh/parsimonhi/animCJK";

function getAnimCjkUrls(char: string): string[] {
  const codePoint = char.codePointAt(0);
  if (typeof codePoint !== "number") return [];

  const isKana =
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
    (codePoint >= 0xff66 && codePoint <= 0xff9d);

  if (isKana) {
    return [`${ANIM_CJK_BASE_URL}/svgsJaKana/${codePoint}.svg`, `${ANIM_CJK_BASE_URL}/svgsJa/${codePoint}.svg`];
  }

  return [`${ANIM_CJK_BASE_URL}/svgsJa/${codePoint}.svg`];
}

function sanitizeAnimCjkSvg(svg: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) return null;

  const svgNode = doc.documentElement;
  if (svgNode.tagName.toLowerCase() !== "svg") return null;

  doc.querySelectorAll("script,foreignObject").forEach((node) => node.remove());

  const elements = doc.querySelectorAll("*");
  elements.forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attr.name);
      }
    });
  });

  return svgNode.outerHTML;
}

async function renderStrokeModel(char: string): Promise<void> {
  const requestId = ++strokeModelRequestId;
  lastStrokeModelSvg = null;
  dom.strokeModel.textContent = "お手本を読み込み中...";
  dom.strokeModel.classList.remove("stroke-model-view--error");

  const urls = getAnimCjkUrls(char);
  if (urls.length === 0) {
    dom.strokeModel.textContent = "お手本データがありません";
    dom.strokeModel.classList.add("stroke-model-view--error");
    return;
  }

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const rawSvg = await response.text();
      const sanitizedSvg = sanitizeAnimCjkSvg(rawSvg);
      if (!sanitizedSvg) continue;
      if (requestId !== strokeModelRequestId) return;

      lastStrokeModelSvg = sanitizedSvg;
      dom.strokeModel.innerHTML = sanitizedSvg;
      dom.strokeModel.classList.remove("stroke-model-view--error");
      return;
    } catch {
      // network error; try the next URL
    }
  }

  if (requestId !== strokeModelRequestId) return;
  dom.strokeModel.textContent = "通信エラーでお手本を表示できませんでした";
  dom.strokeModel.classList.add("stroke-model-view--error");
}

function replayStrokeModel(): void {
  if (lastStrokeModelSvg) {
    dom.strokeModel.innerHTML = lastStrokeModelSvg;
    dom.strokeModel.classList.remove("stroke-model-view--error");
    return;
  }

  const currentChar = getActiveChar();
  if (!currentChar) return;
  void renderStrokeModel(currentChar);
}

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

function getByteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderStorageSummary(): void {
  const missionsRaw = localStorage.getItem(STORAGE_KEYS.missions) ?? JSON.stringify(state.missions);
  const historyRaw = localStorage.getItem(STORAGE_KEYS.history) ?? JSON.stringify(state.history);
  const usedBytes = getByteSize(missionsRaw) + getByteSize(historyRaw);
  const entryCount = state.history.length;
  dom.storageSummary.textContent = `保存中: ${entryCount}文字 / 現在の使用容量: ${formatBytes(usedBytes)}`;
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

function loadPortalTheme(): PortalTheme {
  const saved = localStorage.getItem(UI_THEME_STORAGE_KEY);
  if (saved === "warm" || saved === "cool" || saved === "fancy" || saved === "cyber") {
    return saved;
  }
  if (saved === "girls") return "fancy";
  if (saved === "boys") return "warm";
  return "warm";
}

function applyPortalTheme(theme: PortalTheme): void {
  portalTheme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  (Object.keys(themeButtons) as PortalTheme[]).forEach((key) => {
    const button = themeButtons[key];
    const active = key === theme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setHomeContentVisibility(contentId: string): void {
  const isDotBurst = contentId === DOTBURST_CONTENT.id;
  const isFlashcard = contentId === FLASHCARD_CONTENT.id;
  const isLargerNumber = contentId === LARGER_NUMBER_CONTENT.id;
  dom.kakitoriHome.classList.toggle("hidden", isDotBurst || isFlashcard || isLargerNumber);
  dom.dotburstHome.classList.toggle("hidden", !isDotBurst);
  dom.flashcardHome.classList.toggle("hidden", !isFlashcard);
  dom.largerNumberHome.classList.toggle("hidden", !isLargerNumber);
  dom.gameTabs.classList.toggle("hidden", isDotBurst || isFlashcard || isLargerNumber);
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

  renderStorageSummary();
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

function updatePlayProgress(): void {
  const mission = getActiveMission();
  if (!mission) {
    dom.playProgressFill.style.width = "0%";
    dom.playProgressPips.innerHTML = "";
    return;
  }

  const total = Math.max(1, mission.word.length);
  const currentIndex = Math.max(0, Math.min(state.active.charIdx, total - 1));
  const ratio = (currentIndex + 1) / total;

  dom.playProgressFill.style.width = `${Math.round(ratio * 100)}%`;
  dom.playProgressPips.innerHTML = Array.from({ length: total }, (_, i) => {
    const cls =
      i < currentIndex ? "play-progress-pip play-progress-pip--done" : i === currentIndex
        ? "play-progress-pip play-progress-pip--current"
        : "play-progress-pip";
    return `<span class="${cls}" aria-hidden="true"></span>`;
  }).join("");
}

function updatePlayScreen(): void {
  const mission = getActiveMission();
  if (!mission) {
    renderRouteView({ contentId: activeContentId, view: "home" }, true);
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
  updatePlayProgress();
  updateStrokeBadge();
  void renderStrokeModel(currentChar);
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

  renderRouteView({ contentId: activeContentId, view: "play" }, true);
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

  downloadHistoryImageEntry(item, index);
}

function buildHistoryFileStem(entry: HistoryEntry, serial: number): string {
  const d = new Date(entry.time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  const order = String(serial + 1).padStart(3, "0");
  return `kana_${entry.char}_${y}${m}${day}_${h}${min}${sec}_${order}`;
}

function downloadHistoryImageEntry(entry: HistoryEntry, serial: number): void {
  const link = document.createElement("a");
  link.download = `${buildHistoryFileStem(entry, serial)}.png`;
  link.href = entry.img;
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
  await downloadHistoryVideoEntry(item, index);
}

async function downloadHistoryVideoEntry(item: HistoryEntry, serial: number): Promise<void> {
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
  link.download = `${buildHistoryFileStem(item, serial)}.webm`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function setBulkButtonsDisabled(disabled: boolean): void {
  dom.downloadAllImagesButton.disabled = disabled;
  dom.downloadAllVideosButton.disabled = disabled;
}

function pruneOldHistory(): void {
  if (state.history.length === 0) return;

  const deleteCount = Math.min(10, state.history.length);
  const ok = window.confirm(`古い記録を${deleteCount}件削除します。よろしいですか？`);
  if (!ok) return;

  state.history = state.history.slice(0, state.history.length - deleteCount);
  saveState(state);
  closeReplay();
  renderHistory();
  renderCalendar();
}

async function downloadAllHistoryImages(): Promise<void> {
  if (bulkDownloadRunning) return;
  const items = state.history;
  if (items.length === 0) return;

  const ok = window.confirm(
    `${items.length}件の画像を一括ダウンロードします。ブラウザで複数ダウンロードの許可が必要な場合があります。実行しますか？`,
  );
  if (!ok) return;

  bulkDownloadRunning = true;
  setBulkButtonsDisabled(true);
  try {
    for (let i = 0; i < items.length; i += 1) {
      downloadHistoryImageEntry(items[i], i);
      await wait(120);
    }
  } finally {
    bulkDownloadRunning = false;
    setBulkButtonsDisabled(false);
  }
}

async function downloadAllHistoryVideos(): Promise<void> {
  if (bulkDownloadRunning) return;
  if (typeof MediaRecorder === "undefined") {
    window.alert("このブラウザは動画保存に対応していません。");
    return;
  }

  const items = state.history;
  if (items.length === 0) return;

  const ok = window.confirm(
    `${items.length}件の動画を順番に作成してダウンロードします。時間がかかります。実行しますか？`,
  );
  if (!ok) return;

  bulkDownloadRunning = true;
  setBulkButtonsDisabled(true);
  try {
    for (let i = 0; i < items.length; i += 1) {
      await downloadHistoryVideoEntry(items[i], i);
      await wait(150);
    }
  } finally {
    bulkDownloadRunning = false;
    setBulkButtonsDisabled(false);
  }
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
  renderRouteView({ contentId: activeContentId, view: "home" }, true);
}

function addMission(): void {
  const word = dom.parentInput.value.trim();
  const count = Number.parseInt(dom.parentCountInput.value, 10);

  if (!word || !isValidMissionWord(word)) {
    dom.addError.textContent = "文字を入力してね！";
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
  renderRouteView({ contentId: activeContentId, view: "home" }, true);
}

function resetAllData(): void {
  const ok = window.confirm("れんしゅう記録と課題を初期状態に戻します。よろしいですか？");
  if (!ok) return;

  state.missions = DEFAULT_MISSIONS.map((mission) => ({ ...mission }));
  state.history = [];
  state.active.missionIdx = -1;
  state.active.charIdx = 0;
  state.active.lap = 1;
  state.active.strokes = [];
  state.active.currentPoints = [];
  selectedCalendarDateKey = null;
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  writingCanvas.clearDrawing();
  writingCanvas.clearGuide();
  dom.targetChar.textContent = "";
  dom.playTitle.textContent = "";
  dom.playLap.textContent = "";
  dom.strokeModel.textContent = "お手本を読み込み中...";
  dom.strokeModel.classList.remove("stroke-model-view--error");
  lastStrokeModelSvg = null;

  saveState(state);
  closeReplay();
  renderMissions();
  renderHistory();
  renderCalendar();
  renderRouteView({ contentId: activeContentId, view: "home" }, true);
}

function launchContent(contentId: string): void {
  const content = LEARNING_CONTENTS.find((item) => item.id === contentId);
  if (!content) return;
  renderRouteView({ contentId: content.id, view: "home" }, true);
}

function getFallbackContentId(): string | null {
  return LEARNING_CONTENTS[0]?.id ?? null;
}

function renderRouteView(route: { contentId: string | null; view: ViewId }, syncUrl: boolean): void {
  if (route.view === "portal") {
    activeContentId = null;
    dotBurstGame.hide();
    flashcardGame.hide();
    largerNumberGame.hide();
    closeReplay();
    router.renderView("portal", { syncUrl, contentId: null });
    return;
  }

  const validContentId = LEARNING_CONTENTS.some((content) => content.id === route.contentId)
    ? route.contentId
    : getFallbackContentId();
  if (!validContentId) {
    activeContentId = null;
    dotBurstGame.hide();
    flashcardGame.hide();
    largerNumberGame.hide();
    router.renderView("portal", { syncUrl, contentId: null });
    return;
  }
  activeContentId = validContentId;
  setHomeContentVisibility(validContentId);

  if (validContentId === DOTBURST_CONTENT.id) {
    flashcardGame.hide();
    largerNumberGame.hide();
    closeReplay();
    router.renderView("home", { syncUrl, contentId: validContentId });
    setHomeContentVisibility(validContentId);
    dotBurstGame.show();
    return;
  }

  if (validContentId === FLASHCARD_CONTENT.id) {
    dotBurstGame.hide();
    largerNumberGame.hide();
    closeReplay();
    router.renderView("home", { syncUrl, contentId: validContentId });
    setHomeContentVisibility(validContentId);
    flashcardGame.show();
    return;
  }

  if (validContentId === LARGER_NUMBER_CONTENT.id) {
    dotBurstGame.hide();
    flashcardGame.hide();
    closeReplay();
    router.renderView("home", { syncUrl, contentId: validContentId });
    setHomeContentVisibility(validContentId);
    largerNumberGame.show();
    return;
  }

  dotBurstGame.hide();
  flashcardGame.hide();
  largerNumberGame.hide();

  if (route.view === "home") {
    renderMissions();
    router.renderView("home", { syncUrl, contentId: validContentId });
    return;
  }

  if (route.view === "parent") {
    renderHistory();
    renderCalendar();
    router.renderView("parent", { syncUrl, contentId: validContentId });
    return;
  }

  const mission = getActiveMission();
  if (!mission) {
    renderMissions();
    router.renderView("home", { syncUrl, contentId: validContentId });
    return;
  }

  router.renderView("play", { syncUrl, contentId: validContentId });
  updatePlayScreen();
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
    renderRouteView({ contentId: activeContentId, view: "home" }, true);
  });
  dom.themeWarmButton.addEventListener("click", () => applyPortalTheme("warm"));
  dom.themeCoolButton.addEventListener("click", () => applyPortalTheme("cool"));
  dom.themeFancyButton.addEventListener("click", () => applyPortalTheme("fancy"));
  dom.themeCyberButton.addEventListener("click", () => applyPortalTheme("cyber"));

  dom.parentTab.addEventListener("click", () => {
    renderRouteView({ contentId: activeContentId, view: "parent" }, true);
  });

  dom.backPortalButton.addEventListener("click", () => {
    renderRouteView({ contentId: null, view: "portal" }, true);
  });
  dom.dotburstBackPortalButton.addEventListener("click", () => {
    renderRouteView({ contentId: null, view: "portal" }, true);
  });
  dom.flashcardBackPortalButton.addEventListener("click", () => {
    renderRouteView({ contentId: null, view: "portal" }, true);
  });
  dom.largerNumberBackPortalButton.addEventListener("click", () => {
    renderRouteView({ contentId: null, view: "portal" }, true);
  });

  dom.backHomeButton.addEventListener("click", () => {
    renderRouteView({ contentId: activeContentId, view: "home" }, true);
  });

  dom.doneButton.addEventListener("click", handleNextChar);
  dom.readCharButton.addEventListener("click", () => {
    speak(getActiveChar());
  });
  dom.clearButton.addEventListener("click", clearCurrentCanvas);
  dom.replayModelButton.addEventListener("click", replayStrokeModel);

  dom.addMissionButton.addEventListener("click", addMission);
  dom.pruneOldHistoryButton.addEventListener("click", pruneOldHistory);
  dom.downloadAllImagesButton.addEventListener("click", () => {
    void downloadAllHistoryImages();
  });
  dom.downloadAllVideosButton.addEventListener("click", () => {
    void downloadAllHistoryVideos();
  });
  dom.resetDataButton.addEventListener("click", resetAllData);
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

  window.addEventListener("popstate", () => {
    renderRouteView(router.resolveUrlRoute(), false);
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
  applyPortalTheme(portalTheme);
  bindEvents();
  renderContentList();
  renderMissions();
  renderHistory();
  renderCalendar();
  updateStrokeBadge();
  updatePlayProgress();
  renderRouteView(router.resolveUrlRoute(), true);
}

init();
