import {
  EXERCISE_COUNT,
  GUIDE_MAP,
  SCORE_KEY,
  STRICT_KEY,
  distance,
  loadArray,
  polylineLength,
  saveJson,
  type GuideDefinition,
  type Point,
  type PracticeLevel,
  type StrictExerciseResult,
  type StrictSessionResult,
} from "./pencil-practice-guide-data";

interface ScoreHistoryRow {
  id: number;
  date: string;
  level: PracticeLevel;
  levelLabel: string;
  averageScore: number;
  passed: number;
  total: number;
}

const ROOT_ID = "pencil-practice-experience";
const MAX_STRICT_SESSIONS = 20;

class PencilPracticeStrictFlow {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly doneButton: HTMLButtonElement;
  private currentGuide: GuideDefinition | null = null;
  private currentLevel: PracticeLevel = "easy";
  private currentStroke: Point[] = [];
  private strokes: Point[][] = [];
  private drawing = false;
  private validStart = false;
  private leftStart = false;
  private pathLength = 0;
  private completionScheduled = false;
  private allowCoreDone = false;
  private syntheticSkip = false;
  private sessionResults: StrictExerciseResult[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    const canvas = root.querySelector<HTMLCanvasElement>('[data-role="canvas"]');
    const doneButton = root.querySelector<HTMLButtonElement>('[data-role="done"]');
    if (!canvas || !doneButton) throw new Error("Missing pencil practice controls");
    this.canvas = canvas;
    this.doneButton = doneButton;
    this.doneButton.textContent = "⏭️ スキップ";
    this.doneButton.classList.remove("pencil-practice-primary");
    this.doneButton.classList.add("pencil-practice-skip");
    this.doneButton.setAttribute("aria-label", "この問題をスキップする");
    this.bindEvents();
    this.observeScreens();
    this.refreshGuide();
  }

  private bindEvents(): void {
    this.root.addEventListener("pointerdown", (event) => this.handlePointerDown(event), true);
    this.root.addEventListener("pointermove", (event) => this.handlePointerMove(event), true);
    this.root.addEventListener("pointerup", (event) => this.handlePointerUp(event), true);
    this.root.addEventListener("pointercancel", (event) => this.handlePointerUp(event), true);
    this.root.addEventListener("click", (event) => this.handleRootClick(event), true);
  }

  private observeScreens(): void {
    const progress = this.root.querySelector<HTMLElement>('[data-role="progress-text"]');
    if (progress) {
      new MutationObserver(() => {
        this.resetExerciseState();
        window.queueMicrotask(() => this.refreshGuide());
      }).observe(progress, { childList: true, characterData: true, subtree: true });
    }

    const resultScreen = this.root.querySelector<HTMLElement>('[data-role="result-screen"]');
    if (resultScreen) {
      new MutationObserver(() => {
        if (resultScreen.classList.contains("is-active")) this.finalizeStrictSession();
      }).observe(resultScreen, { attributes: true, attributeFilter: ["class"] });
    }
  }

  private handleRootClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const startButton = target.closest<HTMLButtonElement>('[data-role^="start-"]');
    if (startButton) {
      const role = startButton.dataset.role ?? "";
      this.currentLevel = role.endsWith("normal") ? "normal" : role.endsWith("hard") ? "hard" : "easy";
      this.sessionResults = [];
      this.resetExerciseState();
      return;
    }
    if (target.closest('[data-role="clear"]')) {
      this.resetExerciseState();
      return;
    }
    if (!target.closest('[data-role="done"]') || this.allowCoreDone) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.skipExercise();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.target !== this.canvas || !this.isGameActive() || this.syntheticSkip) return;
    this.refreshGuide();
    const guide = this.currentGuide;
    if (!guide) return;
    const point = this.eventPoint(event);
    const existingPoints = this.strokes.flat();
    const firstStroke = existingPoints.length === 0;
    const expectedStart = firstStroke ? guide.points[0] : existingPoints[existingPoints.length - 1];
    const startTolerance = guide.corridor * (firstStroke ? 1.15 : 1.5);
    if (!expectedStart || distance(point, expectedStart) > startTolerance) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.showFeedback(firstStroke ? "①から はじめてね" : "さっきの つづきから かいてね");
      return;
    }
    this.currentStroke = [point];
    this.drawing = true;
    if (firstStroke) {
      this.validStart = true;
      this.leftStart = false;
      this.pathLength = 0;
    }
    this.completionScheduled = false;
    this.hideFeedback();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (event.target !== this.canvas || !this.drawing || this.syntheticSkip) return;
    const point = this.eventPoint(event);
    const previous = this.currentStroke[this.currentStroke.length - 1];
    if (previous) this.pathLength += distance(previous, point);
    if (!previous || distance(previous, point) >= 0.003) this.currentStroke.push(point);

    const guide = this.currentGuide;
    const start = guide?.points[0];
    const goal = guide?.points[guide.points.length - 1];
    if (!guide || !start || !goal) return;
    if (distance(point, start) > guide.corridor * 1.5) this.leftStart = true;
    if (
      this.validStart &&
      this.leftStart &&
      this.strokes.reduce((count, stroke) => count + stroke.length, 0) + this.currentStroke.length >= 5 &&
      this.pathLength >= polylineLength(guide.points) * 0.2 &&
      distance(point, goal) <= guide.corridor * 1.15
    ) {
      this.scheduleAutomaticCompletion();
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (event.target !== this.canvas || !this.drawing || this.syntheticSkip) return;
    const point = this.eventPoint(event);
    const previous = this.currentStroke[this.currentStroke.length - 1];
    if (!previous || distance(previous, point) >= 0.001) this.currentStroke.push(point);
    if (this.currentStroke.length > 1) this.strokes.push(this.currentStroke.map((value) => ({ ...value })));
    this.currentStroke = [];
    this.drawing = false;

    const guide = this.currentGuide;
    const goal = guide?.points[guide.points.length - 1];
    if (guide && goal && this.validStart && this.leftStart && distance(point, goal) <= guide.corridor * 1.15) {
      this.scheduleAutomaticCompletion();
    }
  }

  private scheduleAutomaticCompletion(): void {
    if (this.completionScheduled) return;
    this.completionScheduled = true;
    window.setTimeout(() => this.completeAutomatically(), 0);
  }

  private completeAutomatically(): void {
    const guide = this.currentGuide;
    if (!guide || !this.isGameActive()) return;
    const drawnPoints = [...this.strokes.flat(), ...this.currentStroke];
    if (drawnPoints.length < 4) return;
    this.drawing = false;
    const score = this.evaluateTrace(guide, drawnPoints);
    this.runCoreDone({
      title: guide.title,
      score,
      passed: score >= this.passThreshold(),
      skipped: false,
    });
    this.showFeedback(`🏁 ゴール！ ${score}てん`);
  }

  private skipExercise(): void {
    if (!this.isGameActive() || this.completionScheduled) return;
    const guide = this.currentGuide;
    if (!guide) return;
    this.syntheticSkip = true;
    try {
      const start = guide.points[0] ?? { x: 0.5, y: 0.5 };
      this.dispatchSyntheticStroke([
        start,
        { x: Math.min(1, start.x + 0.004), y: start.y },
        { x: Math.min(1, start.x + 0.008), y: start.y },
        { x: Math.min(1, start.x + 0.012), y: start.y },
      ]);
    } finally {
      this.syntheticSkip = false;
    }
    this.runCoreDone({ title: guide.title, score: 0, passed: false, skipped: true });
    this.showFeedback("⏭️ スキップしました");
  }

  private dispatchSyntheticStroke(points: Point[]): void {
    const rect = this.canvas.getBoundingClientRect();
    const pointerId = 999;
    const dispatch = (type: string, point: Point): void => {
      this.canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        clientX: rect.left + point.x * rect.width,
        clientY: rect.top + point.y * rect.height,
        buttons: type === "pointerup" ? 0 : 1,
      }));
    };
    const originalSetPointerCapture = this.canvas.setPointerCapture.bind(this.canvas);
    this.canvas.setPointerCapture = () => undefined;
    try {
      dispatch("pointerdown", points[0] ?? { x: 0.5, y: 0.5 });
      points.slice(1, -1).forEach((point) => dispatch("pointermove", point));
      dispatch("pointerup", points[points.length - 1] ?? { x: 0.51, y: 0.5 });
    } finally {
      this.canvas.setPointerCapture = originalSetPointerCapture;
    }
  }

  private runCoreDone(result: StrictExerciseResult): void {
    this.sessionResults.push(result);
    this.allowCoreDone = true;
    try {
      this.doneButton.click();
    } finally {
      this.allowCoreDone = false;
    }
    this.completionScheduled = true;
  }

  private evaluateTrace(guide: GuideDefinition, drawnPoints: Point[]): number {
    const tolerance = guide.corridor * 0.55;
    const coverage = guide.points.filter((guidePoint) =>
      drawnPoints.some((drawnPoint) => distance(guidePoint, drawnPoint) <= tolerance),
    ).length / Math.max(1, guide.points.length);
    const precision = drawnPoints.filter((drawnPoint) =>
      guide.points.some((guidePoint) => distance(guidePoint, drawnPoint) <= tolerance),
    ).length / Math.max(1, drawnPoints.length);
    const guideLength = polylineLength(guide.points);
    const drawnLength = polylineLength(drawnPoints);
    const lengthSimilarity = guideLength > 0 && drawnLength > 0
      ? Math.min(guideLength / drawnLength, drawnLength / guideLength, 1)
      : 0;
    const firstDrawn = drawnPoints[0];
    const lastDrawn = drawnPoints[drawnPoints.length - 1];
    const firstGuide = guide.points[0];
    const lastGuide = guide.points[guide.points.length - 1];
    const endpointTolerance = guide.corridor * 0.85;
    const startOk = Boolean(firstDrawn && firstGuide && distance(firstDrawn, firstGuide) <= endpointTolerance);
    const goalOk = Boolean(lastDrawn && lastGuide && distance(lastDrawn, lastGuide) <= endpointTolerance);
    return Math.round(Math.min(
      100,
      coverage * 45 + precision * 30 + lengthSimilarity * 15 + (startOk ? 5 : 0) + (goalOk ? 5 : 0),
    ));
  }

  private passThreshold(): number {
    if (this.currentLevel === "hard") return 75;
    if (this.currentLevel === "normal") return 70;
    return 65;
  }

  private finalizeStrictSession(): void {
    if (this.sessionResults.length !== EXERCISE_COUNT) return;
    const history = this.loadScoreHistory();
    const latest = history[0];
    if (!latest) return;
    const average = Math.round(this.sessionResults.reduce((sum, result) => sum + result.score, 0) / EXERCISE_COUNT);
    const passed = this.sessionResults.filter((result) => result.passed).length;
    latest.averageScore = average;
    latest.passed = passed;
    saveJson(SCORE_KEY, history);

    const score = this.root.querySelector<HTMLElement>('[data-role="result-score"]');
    const detail = this.root.querySelector<HTMLElement>('[data-role="result-detail"]');
    const stars = this.root.querySelector<HTMLElement>('[data-role="result-stars"]');
    if (score) score.textContent = String(average);
    if (detail) detail.textContent = `${latest.levelLabel} ・ ${passed}/${EXERCISE_COUNT}もん よく なぞれた`;
    if (stars) stars.textContent = average >= 85 ? "⭐⭐⭐" : average >= 65 ? "⭐⭐" : "⭐";

    const sessions = this.loadStrictSessions().filter((row) => row.historyId !== latest.id);
    sessions.unshift({ historyId: latest.id, exercises: this.sessionResults.map((result) => ({ ...result })) });
    saveJson(STRICT_KEY, sessions.slice(0, MAX_STRICT_SESSIONS));
  }

  private loadScoreHistory(): ScoreHistoryRow[] {
    return loadArray(SCORE_KEY).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Partial<ScoreHistoryRow>;
      if (
        typeof row.id !== "number" ||
        typeof row.date !== "string" ||
        (row.level !== "easy" && row.level !== "normal" && row.level !== "hard") ||
        typeof row.levelLabel !== "string" ||
        typeof row.averageScore !== "number" ||
        typeof row.passed !== "number" ||
        typeof row.total !== "number"
      ) return [];
      return [{
        id: row.id,
        date: row.date,
        level: row.level,
        levelLabel: row.levelLabel,
        averageScore: row.averageScore,
        passed: row.passed,
        total: row.total,
      }];
    });
  }

  private loadStrictSessions(): StrictSessionResult[] {
    return loadArray(STRICT_KEY).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Partial<StrictSessionResult>;
      if (typeof row.historyId !== "number" || !Array.isArray(row.exercises)) return [];
      const exercises = row.exercises.flatMap((exercise) => {
        if (typeof exercise !== "object" || exercise === null) return [];
        const value = exercise as Partial<StrictExerciseResult>;
        if (
          typeof value.title !== "string" ||
          typeof value.score !== "number" ||
          typeof value.passed !== "boolean" ||
          typeof value.skipped !== "boolean"
        ) return [];
        return [{ title: value.title, score: value.score, passed: value.passed, skipped: value.skipped }];
      });
      return [{ historyId: row.historyId, exercises }];
    });
  }

  private refreshGuide(): void {
    const title = this.root.querySelector<HTMLElement>('[data-role="exercise-title"]')?.textContent?.trim() ?? "";
    this.currentGuide = GUIDE_MAP.get(title) ?? null;
  }

  private resetExerciseState(): void {
    this.currentStroke = [];
    this.strokes = [];
    this.drawing = false;
    this.validStart = false;
    this.leftStart = false;
    this.pathLength = 0;
    this.completionScheduled = false;
  }

  private isGameActive(): boolean {
    return this.root.querySelector<HTMLElement>('[data-role="game-screen"]')?.classList.contains("is-active") ?? false;
  }

  private eventPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  private showFeedback(message: string): void {
    const feedback = this.root.querySelector<HTMLElement>('[data-role="feedback"]');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-notice");
    feedback.classList.add("is-positive");
  }

  private hideFeedback(): void {
    this.root.querySelector<HTMLElement>('[data-role="feedback"]')?.classList.add("hidden");
  }
}

function initPencilPracticeStrictFlow(): void {
  const attach = (): boolean => {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.strictFlowBound === "true") return false;
    root.dataset.strictFlowBound = "true";
    new PencilPracticeStrictFlow(root);
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
  document.addEventListener("DOMContentLoaded", initPencilPracticeStrictFlow, { once: true });
} else {
  initPencilPracticeStrictFlow();
}
