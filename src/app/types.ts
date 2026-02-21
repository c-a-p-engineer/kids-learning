export type ViewId = "portal" | "home" | "play" | "parent";

export interface Point {
  x: number;
  y: number;
  t: number;
}

export interface StrokeGuide {
  n: [number, number];
  s: [number, number];
  e: [number, number];
}

export interface Mission {
  id: string;
  title: string;
  word: string;
  count: number;
  current: number;
}

export interface HistoryEntry {
  char: string;
  img: string;
  data: Point[][];
  time: number;
}

export interface ActiveState {
  missionIdx: number;
  charIdx: number;
  lap: number;
  strokes: Point[][];
  currentPoints: Point[];
}

export interface AppState {
  missions: Mission[];
  history: HistoryEntry[];
  active: ActiveState;
}

export interface LearningContent {
  id: string;
  title: string;
  description: string;
  tags: string[];
}
