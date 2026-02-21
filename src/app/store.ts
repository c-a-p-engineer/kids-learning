import { DEFAULT_MISSIONS, STORAGE_KEYS } from "./constants";
import type { ActiveState, AppState, HistoryEntry, Mission, Point } from "./types";

const KANA_PATTERN = /^[ぁ-んァ-ンー]+$/;

const DEFAULT_ACTIVE: ActiveState = {
  missionIdx: -1,
  charIdx: 0,
  lap: 1,
  strokes: [],
  currentPoints: [],
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Point;
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.t);
}

function isPointStroke(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(isPoint);
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as HistoryEntry;
  return (
    typeof entry.missionId === "string" &&
    typeof entry.char === "string" &&
    typeof entry.img === "string" &&
    Number.isFinite(entry.time) &&
    Array.isArray(entry.data) &&
    entry.data.every(isPointStroke)
  );
}

function toHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<HistoryEntry> & { missionId?: unknown };

  const normalized: HistoryEntry = {
    missionId: typeof raw.missionId === "string" ? raw.missionId : "",
    char: typeof raw.char === "string" ? raw.char : "",
    img: typeof raw.img === "string" ? raw.img : "",
    data: Array.isArray(raw.data) ? raw.data : [],
    time: Number.isFinite(raw.time) ? Number(raw.time) : NaN,
  };

  return isHistoryEntry(normalized) ? normalized : null;
}

function toMission(value: unknown, index: number): Mission | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<Mission> & { word?: unknown; count?: unknown; current?: unknown };
  if (typeof raw.word !== "string") return null;
  if (!KANA_PATTERN.test(raw.word)) return null;

  const count = Number.isFinite(raw.count) ? Math.max(1, Math.floor(Number(raw.count))) : 1;
  const current = Number.isFinite(raw.current) ? Math.max(0, Math.floor(Number(raw.current))) : 0;
  const lastPracticedAt = Number.isFinite(raw.lastPracticedAt)
    ? Math.max(0, Math.floor(Number(raw.lastPracticedAt)))
    : null;
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `mission-${index}-${raw.word}`;
  const title = typeof raw.title === "string" && raw.title.length > 0 ? raw.title : raw.word;

  return {
    id,
    title,
    word: raw.word,
    count,
    current: Math.min(current, count),
    lastPracticedAt,
  };
}

function cloneDefaultMissions(): Mission[] {
  return DEFAULT_MISSIONS.map((mission) => ({ ...mission }));
}

export function loadState(): AppState {
  const rawMissions = safeParse<unknown[]>(localStorage.getItem(STORAGE_KEYS.missions)) ?? [];
  const rawHistory = safeParse<unknown[]>(localStorage.getItem(STORAGE_KEYS.history)) ?? [];

  const missions = rawMissions.map(toMission).filter((mission): mission is Mission => mission !== null);
  const history = rawHistory.map(toHistoryEntry).filter((entry): entry is HistoryEntry => entry !== null);

  return {
    missions: missions.length > 0 ? missions : cloneDefaultMissions(),
    history,
    active: { ...DEFAULT_ACTIVE },
  };
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEYS.missions, JSON.stringify(state.missions));
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history.slice(0, 100)));
}

export function createMission(word: string, count: number): Mission {
  const now = Date.now();
  const safeCount = Math.max(1, Math.floor(count));
  return {
    id: `mission-${now.toString(36)}`,
    title: word,
    word,
    count: safeCount,
    current: 0,
    lastPracticedAt: null,
  };
}

export function isValidMissionWord(word: string): boolean {
  return KANA_PATTERN.test(word);
}
