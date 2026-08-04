import { audioService } from "./app/audio";
import {
  GUIDE_MAP,
  REPLAY_KEY,
  SCORE_KEY,
  STRICT_KEY,
  distance,
  loadArray,
  polylineLength,
  saveJson,
  type GuideDefinition,
  type Point,
  type PracticeLevel,
  type TimedPoint,
} from "./pencil-practice-guide-data";
import "./styles/pencil-practice.scss";
import "./styles/pencil-practice-video.scss";
import "./styles/pencil-practice-timed.scss";

type Screen = "start" | "game" | "history" | "result";

interface ScoreHistoryRow {
  id: number;
  date: string;
  level: PracticeLevel;
  levelLabel: string;
  averageScore: number;
  passed: number;
  total: number;
  completedCount?: number;
  skippedCount?: number;
  durationSeconds?: number;
}

interface ReplayExercise {
  title: string;
  score: number;
  skipped: boolean;
  strokes: TimedPoint[][];
}

interface ReplaySession {
  historyId: number;
  date: string;
  levelLabel: string;
  exercises: ReplayExercise[];
}

interface StrictSession {
  historyId: number;
  exercises: Array<{ title: string; score: number; passed: boolean; skipped: boolean }>;
}

const CONTENT_ID = "pencil-practice";
const ROOT_ID = "pencil-practice-experience";
const SESSION_TIME_MS = 60_000;
const MAX_SCORE_HISTORY = 50;
const MAX_REPLAY_HISTORY = 20;
const MAX_STRICT_HISTORY = 20;
const CANVAS_SIZE = 640;

const LEVEL_TITLES: Record<PracticeLevel, string[]> = {
  easy: ["よこに すーっ", "うえから したへ", "ななめに すーっ", "ゆるい なみ", "おおきな やま"],
  normal: ["くねくね なみ", "ぎざぎざ やま", "Sの みち", "まるを ぐるっと", "かいだんの みち"],
  hard: ["さんかく", "しかく", "ぐるぐる うずまき", "こまかい なみ", "ひしがた"],
};

class TimedPencilPractice {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly replayCanvas: HTMLCanvasElement;
  private readonly replayContext: CanvasRenderingContext2D;
  private readonly portalPath: string;
  private screen: Screen = "start";
  private level: PracticeLevel = "easy";
  private timeLeftMs = SESSION_TIME_MS;
  private lastTimestamp = 0;
  private rafId: number | null = null;
  private nextTimerId: number | null = null;
  private queue: GuideDefinition[] = [];
  private currentGuide: GuideDefinition | null = null;
  private previousTitle = "";
  private completedCount = 0;
  private attemptedCount = 0;
  private skippedCount = 0;
  private passedCount = 0;
  private scores: number[] = [];
  private sessionExercises: ReplayExercise[] = [];
  private strokes: Point[][] = [];
  private timedStrokes: TimedPoint[][] = [];
  private currentStroke: Point[] = [];
  private currentTimedStroke: TimedPoint[] = [];
  private drawing = false;
  private validStart = false;
  private leftStart = false;
  private pathLength = 0;
  private locked = false;
  private exerciseStartedAt = performance.now();
  private activeReplay: ReplaySession | null = null;
  private replayRunId = 0;

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");
    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = ROOT_ID;
    this.root.className = "pencil-practice-experience hidden";
    this.root.setAttribute("aria-label", "えんぴつれんしゅう");
    this.root.innerHTML = this.template();
    main.appendChild(this.root);

    this.canvas = this.node<HTMLCanvasElement>("canvas");
    const context = this.canvas.getContext("2d");
    this.replayCanvas = this.videoNode<HTMLCanvasElement>("canvas");
    const replayContext = this.replayCanvas.getContext("2d");
    if (!context || !replayContext) throw new Error("Canvas 2D context is unavailable");
    this.context = context;
    this.replayContext = replayContext;
    this.bindEvents();
  }

  init(): void {
    this.bindPortalCard();
    window.addEventListener("popstate", () => window.requestAnimationFrame(() => this.syncFromLocation()));
    this.syncFromLocation();
  }

  private template(): string {
    return `
      <div class="pencil-practice-shell">
        <header class="pencil-practice-header">
          <div>
            <p class="pencil-practice-step">STEP 8</p>
            <h2>🖍️ えんぴつれんしゅう</h2>
          </div>
          <button type="button" class="pencil-practice-back" data-role="back-portal" aria-label="学びの一覧にもどる">🏠 いちらん</button>
        </header>

        <section class="pencil-practice-screen is-active" data-role="start-screen">
          <div class="pencil-practice-hero" aria-hidden="true">✏️〰️🏁</div>
          <h3>60びょうで<br>なんこ できるかな？</h3>
          <p class="pencil-practice-limit">⏱️ どのレベルも 60びょうで おしまい</p>
          <div class="pencil-practice-levels">
            <button type="button" data-role="start-easy">🐣 やさしい<br><small>まっすぐ・おおきな せん</small></button>
            <button type="button" data-role="start-normal">🦁 ふつう<br><small>なみ・ぎざぎざ・まる</small></button>
            <button type="button" data-role="start-hard">🚀 むずかしい<br><small>ずけい・うずまき・こまかい せん</small></button>
          </div>
          <button type="button" class="pencil-practice-sub" data-role="open-history">📊 きろくを みる</button>
        </section>

        <section class="pencil-practice-screen" data-role="game-screen">
          <div class="pencil-practice-progress pencil-practice-progress--timed">
            <strong data-role="progress-text">0こ</strong>
            <div class="pencil-practice-progress-track" aria-label="のこり時間">
              <div class="pencil-practice-progress-fill" data-role="progress-fill"></div>
            </div>
            <strong class="pencil-practice-timer" data-role="timer">1:00</strong>
          </div>
          <h3 data-role="exercise-title">よこに すーっ</h3>
          <p class="pencil-practice-hint" data-role="exercise-hint">①から 🏁まで なぞろう</p>
          <div class="pencil-practice-canvas-wrap">
            <canvas data-role="canvas" width="640" height="640" aria-label="始点からゴールまで線をなぞる場所"></canvas>
          </div>
          <div class="pencil-practice-feedback hidden" data-role="feedback" aria-live="assertive"></div>
          <div class="pencil-practice-game-actions">
            <button type="button" data-role="clear">🧹 やりなおす</button>
            <button type="button" class="pencil-practice-skip" data-role="done">⏭️ スキップ</button>
          </div>
        </section>

        <section class="pencil-practice-screen" data-role="history-screen">
          <h3>📊 これまでの きろく</h3>
          <div class="pencil-practice-history" data-role="history-list"></div>
          <div class="pencil-practice-actions">
            <button type="button" data-role="history-back">↩️ もどる</button>
          </div>
        </section>

        <section class="pencil-practice-screen" data-role="result-screen">
          <div class="pencil-practice-finish" aria-hidden="true">🏁</div>
          <h3>60びょう おしまい！</h3>
          <div class="pencil-practice-result-card">
            <div class="pencil-practice-stars" data-role="result-stars">⭐</div>
            <strong data-role="result-count">0</strong><span>こ できた！</span>
            <p data-role="result-detail"></p>
          </div>
          <button type="button" class="pencil-practice-primary pencil-practice-menu pencil-video-result-button" data-role="result-replay">▶️ どうがを みる</button>
          <button type="button" class="pencil-practice-menu" data-role="result-back">🎮 メニューへ</button>
        </section>
      </div>

      <div class="pencil-video-overlay hidden" data-video-role="overlay" aria-hidden="true">
        <div class="pencil-video-panel" role="dialog" aria-modal="true" aria-labelledby="pencil-video-title">
          <div class="pencil-video-heading">
            <div>
              <p data-video-role="progress">1 / 1</p>
              <h3 id="pencil-video-title" data-video-role="title">どうが さいせい</h3>
            </div>
            <button type="button" data-video-role="close" aria-label="動画を閉じる">✖️ とじる</button>
          </div>
          <div class="pencil-video-canvas-wrap">
            <canvas data-video-role="canvas" width="640" height="640" aria-label="描いた線の再生画面"></canvas>
          </div>
          <p class="pencil-video-status" data-video-role="status" aria-live="polite"></p>
          <div class="pencil-video-actions">
            <button type="button" data-video-role="again">🔁 もういちど</button>
            <button type="button" data-video-role="download">⬇️ どうがを ほぞん</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.node<HTMLButtonElement>("start-easy").addEventListener("click", () => this.startSession("easy"));
    this.node<HTMLButtonElement>("start-normal").addEventListener("click", () => this.startSession("normal"));
    this.node<HTMLButtonElement>("start-hard").addEventListener("click", () => this.startSession("hard"));
    this.node<HTMLButtonElement>("open-history").addEventListener("click", () => this.showHistory());
    this.node<HTMLButtonElement>("history-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("result-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("result-replay").addEventListener("click", () => {
      if (this.activeReplay) this.openReplay(this.activeReplay);
    });
    this.node<HTMLButtonElement>("clear").addEventListener("click", () => this.clearDrawing());
    this.node<HTMLButtonElement>("done").addEventListener("click", () => this.finishExercise(true));

    this.canvas.addEventListener("pointerdown", (event) => this.beginStroke(event));
    this.canvas.addEventListener("pointermove", (event) => this.moveStroke(event));
    this.canvas.addEventListener("pointerup", (event) => this.endStroke(event));
    this.canvas.addEventListener("pointercancel", (event) => this.endStroke(event));
    this.canvas.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && this.drawing) this.endStroke(event);
    });

    this.node<HTMLElement>("history-list").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest<HTMLButtonElement>("[data-replay-id]");
      if (!button) return;
      const id = Number(button.dataset.replayId);
      const replay = this.loadReplays().find((row) => row.historyId === id);
      if (replay) this.openReplay(replay);
    });

    this.videoNode<HTMLElement>("overlay").addEventListener("click", (event) => {
      if (event.target === this.videoNode<HTMLElement>("overlay")) this.closeReplay();
    });
    this.videoNode<HTMLButtonElement>("close").addEventListener("click", () => this.closeReplay());
    this.videoNode<HTMLButtonElement>("again").addEventListener("click", () => {
      if (this.activeReplay) void this.playReplay(this.activeReplay);
    });
    this.videoNode<HTMLButtonElement>("download").addEventListener("click", () => void this.downloadReplay());
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.timedPencilBound === "true") return;
    list.dataset.timedPencilBound = "true";
    list.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const card = target.closest<HTMLElement>(`[data-content-id="${CONTENT_ID}"]`);
        if (!card) return;
        event.preventDefault();
        event.stopPropagation();
        this.open();
      },
      { capture: true },
    );
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.stopSession();
    this.closeReplay();
    window.history.pushState(null, "", this.portalPath);
    this.root.classList.add("hidden");
    document.getElementById("view-portal")?.classList.remove("hidden");
  }

  private syncFromLocation(): void {
    if (this.isCurrentPath()) this.showExperience();
    else {
      this.stopSession();
      this.root.classList.add("hidden");
    }
  }

  private showExperience(): void {
    document.querySelectorAll<HTMLElement>("#main-content > section").forEach((section) => {
      section.classList.toggle("hidden", section !== this.root);
    });
    this.root.classList.remove("hidden");
    this.showScreen("start");
  }

  private startSession(level: PracticeLevel): void {
    audioService.resume();
    this.stopSession();
    this.level = level;
    this.timeLeftMs = SESSION_TIME_MS;
    this.completedCount = 0;
    this.attemptedCount = 0;
    this.skippedCount = 0;
    this.passedCount = 0;
    this.scores = [];
    this.sessionExercises = [];
    this.queue = [];
    this.previousTitle = "";
    this.activeReplay = null;
    this.node<HTMLButtonElement>("result-replay").disabled = true;
    this.showScreen("game");
    this.prepareExercise();
    this.updateStatus();
    this.lastTimestamp = performance.now();
    this.rafId = window.requestAnimationFrame((now) => this.gameLoop(now));
  }

  private gameLoop(now: number): void {
    if (this.screen !== "game") return;
    const delta = Math.max(0, now - this.lastTimestamp);
    this.lastTimestamp = now;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    this.updateStatus();
    if (this.timeLeftMs <= 0) {
      this.endSession();
      return;
    }
    this.rafId = window.requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  private prepareExercise(): void {
    if (this.screen !== "game" || this.timeLeftMs <= 0) return;
    if (this.queue.length === 0) {
      const guides = LEVEL_TITLES[this.level]
        .map((title) => GUIDE_MAP.get(title))
        .filter((guide): guide is GuideDefinition => Boolean(guide));
      this.queue = this.shuffle(guides);
      if (this.queue[0]?.title === this.previousTitle && this.queue.length > 1) {
        const first = this.queue.shift();
        if (first) this.queue.push(first);
      }
    }
    this.currentGuide = this.queue.shift() ?? null;
    if (!this.currentGuide) return;
    this.previousTitle = this.currentGuide.title;
    this.locked = false;
    this.resetTraceState();
    this.node<HTMLElement>("exercise-title").textContent = this.currentGuide.title;
    this.node<HTMLElement>("exercise-hint").textContent = "①から 🏁まで みちの まんなかを なぞろう";
    this.hideFeedback();
    this.drawPracticeCanvas();
  }

  private beginStroke(event: PointerEvent): void {
    if (this.screen !== "game" || this.locked || !this.currentGuide) return;
    const point = this.eventPoint(event);
    const existing = this.strokes.flat();
    const expectedStart = existing.length === 0 ? this.currentGuide.points[0] : existing[existing.length - 1];
    if (!expectedStart) return;
    const tolerance = this.currentGuide.corridor * (existing.length === 0 ? 1.15 : 1.5);
    if (distance(point, expectedStart) > tolerance) {
      this.showFeedback(existing.length === 0 ? "①から はじめてね" : "さっきの つづきから かいてね", false);
      return;
    }
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    this.drawing = true;
    this.currentStroke = [point];
    this.currentTimedStroke = [{ ...point, t: performance.now() - this.exerciseStartedAt }];
    if (existing.length === 0) {
      this.validStart = true;
      this.leftStart = false;
      this.pathLength = 0;
    }
    this.hideFeedback();
  }

  private moveStroke(event: PointerEvent): void {
    if (!this.drawing || this.locked || !this.currentGuide) return;
    const point = this.eventPoint(event);
    const previous = this.currentStroke[this.currentStroke.length - 1];
    if (previous) this.pathLength += distance(previous, point);
    if (!previous || distance(previous, point) >= 0.003) {
      this.currentStroke.push(point);
      this.currentTimedStroke.push({ ...point, t: performance.now() - this.exerciseStartedAt });
    }
    const start = this.currentGuide.points[0];
    const goal = this.currentGuide.points[this.currentGuide.points.length - 1];
    if (!start || !goal) return;
    if (distance(point, start) > this.currentGuide.corridor * 1.5) this.leftStart = true;
    this.drawPracticeCanvas();

    const pointCount = this.strokes.reduce((sum, stroke) => sum + stroke.length, 0) + this.currentStroke.length;
    if (
      this.validStart &&
      this.leftStart &&
      pointCount >= 5 &&
      this.pathLength >= polylineLength(this.currentGuide.points) * 0.2 &&
      distance(point, goal) <= this.currentGuide.corridor * 1.15
    ) {
      this.finishExercise(false);
    }
  }

  private endStroke(event: PointerEvent): void {
    if (!this.drawing || this.locked || !this.currentGuide) return;
    const point = this.eventPoint(event);
    const previous = this.currentStroke[this.currentStroke.length - 1];
    if (!previous || distance(previous, point) >= 0.001) {
      this.currentStroke.push(point);
      this.currentTimedStroke.push({ ...point, t: performance.now() - this.exerciseStartedAt });
    }
    if (this.currentStroke.length > 1) {
      this.strokes.push(this.currentStroke.map((value) => ({ ...value })));
      this.timedStrokes.push(this.compactTimedStroke(this.currentTimedStroke));
    }
    this.currentStroke = [];
    this.currentTimedStroke = [];
    this.drawing = false;
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.drawPracticeCanvas();

    const goal = this.currentGuide.points[this.currentGuide.points.length - 1];
    if (goal && this.validStart && this.leftStart && distance(point, goal) <= this.currentGuide.corridor * 1.15) {
      this.finishExercise(false);
    }
  }

  private finishExercise(skipped: boolean): void {
    if (this.screen !== "game" || this.locked || !this.currentGuide) return;
    if (!skipped && this.currentPoints().length < 4) return;
    this.locked = true;
    this.drawing = false;
    const points = this.currentPoints();
    const score = skipped ? 0 : this.evaluateTrace(this.currentGuide, points);
    const passed = !skipped && score >= this.passThreshold();
    const replayStrokes = this.completedTimedStrokes();

    this.attemptedCount += 1;
    if (skipped) this.skippedCount += 1;
    else {
      this.completedCount += 1;
      this.scores.push(score);
      if (passed) this.passedCount += 1;
    }
    this.sessionExercises.push({
      title: this.currentGuide.title,
      score,
      skipped,
      strokes: replayStrokes,
    });
    this.updateStatus();
    if (skipped) {
      audioService.playTone({ frequency: 260, type: "triangle", gain: 0.05, durationMs: 100 });
      this.showFeedback("⏭️ つぎの みちへ", false);
    } else {
      audioService.playTone({ frequency: 760, sweepToFrequency: 1140, type: "triangle", gain: 0.1, durationMs: 220 });
      this.showFeedback(`🏁 ゴール！ ${score}てん`, true);
    }

    this.nextTimerId = window.setTimeout(() => {
      this.nextTimerId = null;
      if (this.screen === "game" && this.timeLeftMs > 0) this.prepareExercise();
    }, skipped ? 260 : 520);
  }

  private clearDrawing(): void {
    if (this.screen !== "game" || this.locked) return;
    this.resetTraceState();
    this.hideFeedback();
    this.drawPracticeCanvas();
  }

  private resetTraceState(): void {
    this.strokes = [];
    this.timedStrokes = [];
    this.currentStroke = [];
    this.currentTimedStroke = [];
    this.drawing = false;
    this.validStart = false;
    this.leftStart = false;
    this.pathLength = 0;
    this.exerciseStartedAt = performance.now();
  }

  private currentPoints(): Point[] {
    return [...this.strokes.flat(), ...this.currentStroke];
  }

  private completedTimedStrokes(): TimedPoint[][] {
    const result = this.timedStrokes.map((stroke) => stroke.map((point) => ({ ...point })));
    if (this.currentTimedStroke.length > 1) result.push(this.compactTimedStroke(this.currentTimedStroke));
    return result;
  }

  private compactTimedStroke(stroke: TimedPoint[]): TimedPoint[] {
    const compact: TimedPoint[] = [];
    stroke.forEach((point, index) => {
      const previous = compact[compact.length - 1];
      const endpoint = index === 0 || index === stroke.length - 1;
      if (endpoint || !previous || distance(point, previous) >= 0.006 || point.t - previous.t >= 24) {
        compact.push({
          x: Math.round(point.x * 10000) / 10000,
          y: Math.round(point.y * 10000) / 10000,
          t: Math.round(point.t),
        });
      }
    });
    return compact;
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
    return Math.round(Math.min(100, coverage * 45 + precision * 30 + lengthSimilarity * 15 + (startOk ? 5 : 0) + (goalOk ? 5 : 0)));
  }

  private passThreshold(): number {
    if (this.level === "hard") return 75;
    if (this.level === "normal") return 70;
    return 65;
  }

  private updateStatus(): void {
    this.node<HTMLElement>("progress-text").textContent = `${this.completedCount}こ`;
    const totalSeconds = Math.ceil(this.timeLeftMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    this.node<HTMLElement>("timer").textContent = `${minutes}:${seconds}`;
    this.node<HTMLElement>("progress-fill").style.width = `${Math.max(0, this.timeLeftMs / SESSION_TIME_MS) * 100}%`;
  }

  private endSession(): void {
    if (this.screen !== "game") return;
    this.stopSession();
    const average = this.scores.length > 0
      ? Math.round(this.scores.reduce((sum, score) => sum + score, 0) / this.scores.length)
      : 0;
    const now = new Date();
    const id = Date.now();
    const date = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    const levelLabel = this.levelLabel(this.level);
    const historyRow: ScoreHistoryRow = {
      id,
      date,
      level: this.level,
      levelLabel,
      averageScore: average,
      passed: this.passedCount,
      total: this.attemptedCount,
      completedCount: this.completedCount,
      skippedCount: this.skippedCount,
      durationSeconds: SESSION_TIME_MS / 1000,
    };
    const history = this.loadScoreHistory().filter((row) => row.id !== id);
    history.unshift(historyRow);
    saveJson(SCORE_KEY, history.slice(0, MAX_SCORE_HISTORY));

    const replay: ReplaySession = {
      historyId: id,
      date,
      levelLabel,
      exercises: this.sessionExercises.map((exercise) => ({
        title: exercise.title,
        score: exercise.score,
        skipped: exercise.skipped,
        strokes: exercise.strokes.map((stroke) => stroke.map((point) => ({ ...point }))),
      })),
    };
    const replays = this.loadReplays().filter((row) => row.historyId !== id);
    replays.unshift(replay);
    saveJson(REPLAY_KEY, replays.slice(0, MAX_REPLAY_HISTORY));

    const strict: StrictSession = {
      historyId: id,
      exercises: this.sessionExercises.map((exercise) => ({
        title: exercise.title,
        score: exercise.score,
        passed: !exercise.skipped && exercise.score >= this.passThreshold(),
        skipped: exercise.skipped,
      })),
    };
    const strictRows = this.loadStrictHistory().filter((row) => row.historyId !== id);
    strictRows.unshift(strict);
    saveJson(STRICT_KEY, strictRows.slice(0, MAX_STRICT_HISTORY));

    this.activeReplay = replay;
    const stars = this.completedCount >= 6 ? "⭐⭐⭐" : this.completedCount >= 3 ? "⭐⭐" : "⭐";
    this.node<HTMLElement>("result-stars").textContent = stars;
    this.node<HTMLElement>("result-count").textContent = String(this.completedCount);
    this.node<HTMLElement>("result-detail").textContent = `${levelLabel} ・ よくなぞれた ${this.passedCount}こ ・ へいきん ${average}てん ・ スキップ ${this.skippedCount}こ`;
    this.node<HTMLButtonElement>("result-replay").disabled = replay.exercises.every((exercise) => exercise.strokes.length === 0);
    this.showScreen("result");
  }

  private showHistory(): void {
    const history = this.loadScoreHistory();
    const replayIds = new Set(this.loadReplays().filter((row) => row.exercises.some((exercise) => exercise.strokes.length > 0)).map((row) => row.historyId));
    const list = this.node<HTMLElement>("history-list");
    if (history.length === 0) {
      list.innerHTML = '<p class="pencil-practice-empty">まだ きろくが ないよ</p>';
    } else {
      list.innerHTML = history.map((row) => {
        const completed = row.completedCount ?? row.total;
        const duration = row.durationSeconds ?? 0;
        const modeLabel = duration > 0 ? `${duration}びょう` : `${row.total}もん`;
        return `
          <article class="pencil-practice-history-item pencil-practice-history-item--timed">
            <div><strong>${row.levelLabel}</strong><span>${row.date}</span></div>
            <p>${modeLabel}</p>
            <b>${completed}こ</b>
            <span>へいきん ${row.averageScore}てん</span>
            <div class="pencil-video-history-actions">
              <button type="button" data-replay-id="${row.id}" ${replayIds.has(row.id) ? "" : "disabled"}>${replayIds.has(row.id) ? "▶️ どうが" : "どうがなし"}</button>
            </div>
          </article>
        `;
      }).join("");
    }
    this.showScreen("history");
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
        completedCount: typeof row.completedCount === "number" ? row.completedCount : undefined,
        skippedCount: typeof row.skippedCount === "number" ? row.skippedCount : undefined,
        durationSeconds: typeof row.durationSeconds === "number" ? row.durationSeconds : undefined,
      }];
    });
  }

  private loadReplays(): ReplaySession[] {
    return loadArray(REPLAY_KEY).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Partial<ReplaySession>;
      if (typeof row.historyId !== "number" || typeof row.date !== "string" || typeof row.levelLabel !== "string" || !Array.isArray(row.exercises)) return [];
      const exercises = row.exercises.flatMap((exercise) => {
        if (typeof exercise !== "object" || exercise === null) return [];
        const value = exercise as Partial<ReplayExercise> & { strokes?: unknown };
        if (typeof value.title !== "string" || !Array.isArray(value.strokes)) return [];
        const strokes = value.strokes.flatMap((stroke) => {
          if (!Array.isArray(stroke)) return [];
          const points = stroke.flatMap((point) => {
            if (typeof point !== "object" || point === null) return [];
            const p = point as Partial<TimedPoint>;
            if (typeof p.x !== "number" || typeof p.y !== "number" || typeof p.t !== "number") return [];
            return [{ x: p.x, y: p.y, t: p.t }];
          });
          return points.length > 0 ? [points] : [];
        });
        return [{
          title: value.title,
          score: typeof value.score === "number" ? value.score : 0,
          skipped: value.skipped === true,
          strokes,
        }];
      });
      return [{ historyId: row.historyId, date: row.date, levelLabel: row.levelLabel, exercises }];
    });
  }

  private loadStrictHistory(): StrictSession[] {
    return loadArray(STRICT_KEY).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Partial<StrictSession>;
      if (typeof row.historyId !== "number" || !Array.isArray(row.exercises)) return [];
      return [{ historyId: row.historyId, exercises: row.exercises as StrictSession["exercises"] }];
    });
  }

  private openReplay(replay: ReplaySession): void {
    this.activeReplay = replay;
    const overlay = this.videoNode<HTMLElement>("overlay");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    void this.playReplay(replay);
  }

  private closeReplay(): void {
    this.replayRunId += 1;
    const overlay = this.root.querySelector<HTMLElement>('[data-video-role="overlay"]');
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  private async playReplay(replay: ReplaySession): Promise<void> {
    const runId = ++this.replayRunId;
    const drawable = replay.exercises.filter((exercise) => exercise.strokes.length > 0);
    if (drawable.length === 0) {
      this.videoNode<HTMLElement>("status").textContent = "さいせいできる せんが ありません";
      return;
    }
    for (let index = 0; index < drawable.length; index += 1) {
      if (runId !== this.replayRunId) return;
      const exercise = drawable[index];
      if (!exercise) continue;
      this.videoNode<HTMLElement>("progress").textContent = `${index + 1} / ${drawable.length}`;
      this.videoNode<HTMLElement>("title").textContent = `${exercise.title} ・ ${exercise.score}てん`;
      this.videoNode<HTMLElement>("status").textContent = "さいせい中…";
      this.drawGuide(this.replayContext, GUIDE_MAP.get(exercise.title) ?? null);
      await this.animateStrokes(this.replayContext, exercise.strokes, runId, 0.42);
      if (runId !== this.replayRunId) return;
      await this.wait(260);
    }
    if (runId === this.replayRunId) this.videoNode<HTMLElement>("status").textContent = "さいせい おしまい";
  }

  private async animateStrokes(context: CanvasRenderingContext2D, strokes: TimedPoint[][], runId: number, speed: number): Promise<void> {
    context.save();
    context.strokeStyle = "#2563eb";
    context.lineWidth = 12;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokes) {
      const first = stroke[0];
      if (!first) continue;
      context.beginPath();
      context.moveTo(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE);
      for (let index = 1; index < stroke.length; index += 1) {
        if (runId !== this.replayRunId) {
          context.restore();
          return;
        }
        const point = stroke[index];
        const previous = stroke[index - 1];
        if (!point || !previous) continue;
        context.lineTo(point.x * CANVAS_SIZE, point.y * CANVAS_SIZE);
        context.stroke();
        const delay = Math.max(4, Math.min(24, (point.t - previous.t) * speed));
        await this.wait(delay);
      }
    }
    context.restore();
  }

  private async downloadReplay(): Promise<void> {
    const replay = this.activeReplay;
    if (!replay || typeof MediaRecorder === "undefined" || typeof this.replayCanvas.captureStream !== "function") {
      window.alert("このブラウザは動画保存に対応していません。");
      return;
    }
    const button = this.videoNode<HTMLButtonElement>("download");
    button.disabled = true;
    const stream = this.replayCanvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const complete = new Promise<Blob>((resolve) => {
      recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
    });
    try {
      recorder.start();
      await this.playReplay(replay);
      await this.wait(250);
      recorder.stop();
      const blob = await complete;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `えんぴつれんしゅう-${replay.historyId}.webm`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      button.disabled = false;
    }
  }

  private drawPracticeCanvas(): void {
    this.drawGuide(this.context, this.currentGuide);
    this.context.save();
    this.context.strokeStyle = "#2563eb";
    this.context.lineWidth = 12;
    this.context.lineCap = "round";
    this.context.lineJoin = "round";
    [...this.strokes, this.currentStroke].forEach((stroke) => {
      const first = stroke[0];
      if (!first) return;
      this.context.beginPath();
      this.context.moveTo(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE);
      stroke.slice(1).forEach((point) => this.context.lineTo(point.x * CANVAS_SIZE, point.y * CANVAS_SIZE));
      this.context.stroke();
    });
    this.context.restore();
  }

  private drawGuide(context: CanvasRenderingContext2D, guide: GuideDefinition | null): void {
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!guide || guide.points.length === 0) return;
    const first = guide.points[0];
    const last = guide.points[guide.points.length - 1];
    if (!first || !last) return;

    const trace = (): void => {
      context.beginPath();
      context.moveTo(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE);
      guide.points.slice(1).forEach((point) => context.lineTo(point.x * CANVAS_SIZE, point.y * CANVAS_SIZE));
    };

    context.save();
    trace();
    context.strokeStyle = "#d1d5db";
    context.lineWidth = Math.max(26, guide.corridor * CANVAS_SIZE * 1.6);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    trace();
    context.setLineDash([14, 12]);
    context.strokeStyle = "#8793a1";
    context.lineWidth = 4;
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#22c55e";
    context.beginPath();
    context.arc(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "bold 25px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("①", first.x * CANVAS_SIZE, first.y * CANVAS_SIZE + 1);

    context.font = "34px sans-serif";
    context.fillText("🏁", last.x * CANVAS_SIZE, last.y * CANVAS_SIZE - 34);
    context.restore();
  }

  private eventPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  private showFeedback(message: string, positive: boolean): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-positive", "is-notice");
    feedback.classList.add(positive ? "is-positive" : "is-notice");
  }

  private hideFeedback(): void {
    this.node<HTMLElement>("feedback").classList.add("hidden");
  }

  private showScreen(screen: Screen): void {
    this.screen = screen;
    this.node<HTMLElement>("start-screen").classList.toggle("is-active", screen === "start");
    this.node<HTMLElement>("game-screen").classList.toggle("is-active", screen === "game");
    this.node<HTMLElement>("history-screen").classList.toggle("is-active", screen === "history");
    this.node<HTMLElement>("result-screen").classList.toggle("is-active", screen === "result");
  }

  private stopSession(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.nextTimerId !== null) {
      window.clearTimeout(this.nextTimerId);
      this.nextTimerId = null;
    }
    this.drawing = false;
  }

  private levelLabel(level: PracticeLevel): string {
    if (level === "easy") return "やさしい";
    if (level === "normal") return "ふつう";
    return "むずかしい";
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = result[index];
      const swap = result[swapIndex];
      if (current === undefined || swap === undefined) continue;
      result[index] = swap;
      result[swapIndex] = current;
    }
    return result;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing timed pencil node: ${role}`);
    return element as T;
  }

  private videoNode<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-video-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing timed pencil video node: ${role}`);
    return element as T;
  }

  private resolvePortalPath(): string {
    const path = window.location.pathname;
    if (path.endsWith(`/${CONTENT_ID}`)) return path.slice(0, -CONTENT_ID.length);
    return path.endsWith("/") ? path : `${path}/`;
  }

  private isCurrentPath(): boolean {
    return window.location.pathname.replace(/\/$/, "").endsWith(`/${CONTENT_ID}`);
  }
}

function initTimedPencilPractice(): void {
  if (document.getElementById(ROOT_ID)) return;
  const game = new TimedPencilPractice();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTimedPencilPractice, { once: true });
} else {
  initTimedPencilPractice();
}
