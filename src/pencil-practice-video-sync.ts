import "./pencil-practice-strict-flow";
import "./pencil-practice-guide-replay";

interface PencilScoreRow {
  id: number;
  date: string;
  levelLabel: string;
}

interface PencilReplayRow {
  historyId: number;
  date: string;
  levelLabel: string;
  exercises: unknown[];
}

const SCORE_KEY = "pencil_practice_v1_history";
const REPLAY_KEY = "pencil_practice_v1_replays";

function loadArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function latestScore(): PencilScoreRow | null {
  const row = loadArray(SCORE_KEY)[0];
  if (typeof row !== "object" || row === null) return null;
  const value = row as Partial<PencilScoreRow>;
  if (typeof value.id !== "number" || typeof value.date !== "string" || typeof value.levelLabel !== "string") return null;
  return { id: value.id, date: value.date, levelLabel: value.levelLabel };
}

function loadReplays(): PencilReplayRow[] {
  return loadArray(REPLAY_KEY).flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const value = row as Partial<PencilReplayRow>;
    if (
      typeof value.historyId !== "number" ||
      typeof value.date !== "string" ||
      typeof value.levelLabel !== "string" ||
      !Array.isArray(value.exercises)
    ) {
      return [];
    }
    return [{ historyId: value.historyId, date: value.date, levelLabel: value.levelLabel, exercises: value.exercises }];
  });
}

function syncLatestReplay(root: HTMLElement): void {
  const score = latestScore();
  const replays = loadReplays();
  const latestReplay = replays[0];
  if (!score || !latestReplay) return;
  if (latestReplay.historyId !== score.id) {
    latestReplay.historyId = score.id;
    latestReplay.date = score.date;
    latestReplay.levelLabel = score.levelLabel;
    const unique = [latestReplay, ...replays.slice(1).filter((row) => row.historyId !== score.id)];
    try {
      localStorage.setItem(REPLAY_KEY, JSON.stringify(unique));
    } catch {
      return;
    }
  }
  const button = root.querySelector<HTMLButtonElement>('[data-video-role="result-replay"]');
  if (button) button.disabled = false;
}

function initPencilReplaySync(): void {
  const attach = (): boolean => {
    const root = document.getElementById("pencil-practice-experience");
    const result = root?.querySelector<HTMLElement>('[data-role="result-screen"]');
    if (!root || !result || result.dataset.videoSyncBound === "true") return false;
    result.dataset.videoSyncBound = "true";
    const syncWhenVisible = (): void => {
      if (result.classList.contains("is-active")) window.setTimeout(() => syncLatestReplay(root), 250);
    };
    new MutationObserver(syncWhenVisible).observe(result, { attributes: true, attributeFilter: ["class"] });
    syncWhenVisible();
    return true;
  };
  if (attach()) return;
  const main = document.getElementById("main-content");
  if (!main) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(main, { childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPencilReplaySync, { once: true });
} else {
  initPencilReplaySync();
}
