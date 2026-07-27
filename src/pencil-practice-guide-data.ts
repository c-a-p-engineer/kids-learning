export type PracticeLevel = "easy" | "normal" | "hard";

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  t: number;
}

export interface GuideDefinition {
  title: string;
  points: Point[];
  corridor: number;
}

export interface StrictExerciseResult {
  title: string;
  score: number;
  passed: boolean;
  skipped: boolean;
}

export interface StrictSessionResult {
  historyId: number;
  exercises: StrictExerciseResult[];
}

export const SCORE_KEY = "pencil_practice_v1_history";
export const REPLAY_KEY = "pencil_practice_v1_replays";
export const STRICT_KEY = "pencil_practice_v1_strict_results";
export const EXERCISE_COUNT = 5;

function interpolatePolyline(controlPoints: Point[], pointsPerSegment = 18): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < controlPoints.length - 1; index += 1) {
    const start = controlPoints[index];
    const end = controlPoints[index + 1];
    if (!start || !end) continue;
    for (let step = 0; step < pointsPerSegment; step += 1) {
      const ratio = step / pointsPerSegment;
      result.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  const last = controlPoints[controlPoints.length - 1];
  if (last) result.push({ ...last });
  return result;
}

function createWave(cycles: number, amplitude: number, centerY = 0.5): Point[] {
  return Array.from({ length: 100 }, (_, index) => {
    const ratio = index / 99;
    return {
      x: 0.12 + ratio * 0.76,
      y: centerY + Math.sin(ratio * Math.PI * 2 * cycles) * amplitude,
    };
  });
}

function createCircle(radius = 0.3): Point[] {
  return Array.from({ length: 121 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / 120) * Math.PI * 2;
    return {
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    };
  });
}

function createSpiral(): Point[] {
  return Array.from({ length: 140 }, (_, index) => {
    const ratio = index / 139;
    const angle = ratio * Math.PI * 4.5;
    const radius = 0.04 + ratio * 0.32;
    return {
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    };
  });
}

function createSCurve(): Point[] {
  return Array.from({ length: 100 }, (_, index) => {
    const ratio = index / 99;
    return {
      x: 0.5 + Math.sin((ratio - 0.5) * Math.PI) * 0.27,
      y: 0.12 + ratio * 0.76,
    };
  });
}

const guides: GuideDefinition[] = [
  { title: "よこに すーっ", points: interpolatePolyline([{ x: 0.14, y: 0.5 }, { x: 0.86, y: 0.5 }]), corridor: 0.085 },
  { title: "うえから したへ", points: interpolatePolyline([{ x: 0.5, y: 0.14 }, { x: 0.5, y: 0.86 }]), corridor: 0.085 },
  { title: "ななめに すーっ", points: interpolatePolyline([{ x: 0.18, y: 0.82 }, { x: 0.82, y: 0.18 }]), corridor: 0.085 },
  { title: "ゆるい なみ", points: createWave(1.5, 0.13), corridor: 0.09 },
  {
    title: "おおきな やま",
    points: interpolatePolyline([
      { x: 0.16, y: 0.76 },
      { x: 0.28, y: 0.42 },
      { x: 0.5, y: 0.2 },
      { x: 0.72, y: 0.42 },
      { x: 0.84, y: 0.76 },
    ]),
    corridor: 0.09,
  },
  { title: "くねくね なみ", points: createWave(2.5, 0.2), corridor: 0.075 },
  {
    title: "ぎざぎざ やま",
    points: interpolatePolyline([
      { x: 0.12, y: 0.72 },
      { x: 0.28, y: 0.28 },
      { x: 0.44, y: 0.72 },
      { x: 0.6, y: 0.28 },
      { x: 0.76, y: 0.72 },
      { x: 0.88, y: 0.38 },
    ]),
    corridor: 0.075,
  },
  { title: "Sの みち", points: createSCurve(), corridor: 0.075 },
  { title: "まるを ぐるっと", points: createCircle(0.31), corridor: 0.075 },
  {
    title: "かいだんの みち",
    points: interpolatePolyline([
      { x: 0.16, y: 0.76 },
      { x: 0.36, y: 0.76 },
      { x: 0.36, y: 0.56 },
      { x: 0.56, y: 0.56 },
      { x: 0.56, y: 0.36 },
      { x: 0.8, y: 0.36 },
    ]),
    corridor: 0.075,
  },
  {
    title: "さんかく",
    points: interpolatePolyline([
      { x: 0.5, y: 0.14 },
      { x: 0.84, y: 0.8 },
      { x: 0.16, y: 0.8 },
      { x: 0.5, y: 0.14 },
    ]),
    corridor: 0.065,
  },
  {
    title: "しかく",
    points: interpolatePolyline([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
      { x: 0.2, y: 0.2 },
    ]),
    corridor: 0.065,
  },
  { title: "ぐるぐる うずまき", points: createSpiral(), corridor: 0.06 },
  { title: "こまかい なみ", points: createWave(4, 0.18), corridor: 0.06 },
  {
    title: "ひしがた",
    points: interpolatePolyline([
      { x: 0.5, y: 0.12 },
      { x: 0.86, y: 0.5 },
      { x: 0.5, y: 0.88 },
      { x: 0.14, y: 0.5 },
      { x: 0.5, y: 0.12 },
    ]),
    corridor: 0.06,
  },
];

export const GUIDE_MAP = new Map(guides.map((guide) => [guide.title, guide]));

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (previous && point) length += distance(previous, point);
  }
  return length;
}

export function loadArray(key: string): unknown[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存に失敗しても学習を継続する。
  }
}
