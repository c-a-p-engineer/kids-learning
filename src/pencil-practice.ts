import { audioService } from "./app/audio";
import "./styles/pencil-practice.scss";

type PracticeLevel = "easy" | "normal" | "hard";
type Screen = "start" | "game" | "history" | "result";

interface Point {
  x: number;
  y: number;
}

interface Exercise {
  id: string;
  title: string;
  hint: string;
  points: Point[];
  corridor: number;
}

interface PracticeHistoryRecord {
  id: number;
  date: string;
  level: PracticeLevel;
  levelLabel: string;
  averageScore: number;
  passed: number;
  total: number;
}

interface PracticeState {
  level: PracticeLevel;
  screen: Screen;
  exerciseIndex: number;
  exercises: Exercise[];
  scores: number[];
  passed: number;
  strokes: Point[][];
  currentStroke: Point[];
  drawing: boolean;
  locked: boolean;
}

const CONTENT_ID = "pencil-practice";
const STORAGE_KEY = "pencil_practice_v1_history";
const MAX_HISTORY = 50;
const EXERCISE_COUNT = 5;
const PATH_ORDER = [
  "fit-shape",
  "flashcard",
  "dotburst",
  "number-sequence",
  "larger-number",
  "clock-reading",
  CONTENT_ID,
  "kakitori",
] as const;

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

function createExercisePool(level: PracticeLevel): Exercise[] {
  const easy: Exercise[] = [
    {
      id: "horizontal",
      title: "よこに すーっ",
      hint: "①から 🏁まで まっすぐ なぞろう",
      points: interpolatePolyline([
        { x: 0.14, y: 0.5 },
        { x: 0.86, y: 0.5 },
      ]),
      corridor: 0.085,
    },
    {
      id: "vertical",
      title: "うえから したへ",
      hint: "①から 🏁まで ゆっくり なぞろう",
      points: interpolatePolyline([
        { x: 0.5, y: 0.14 },
        { x: 0.5, y: 0.86 },
      ]),
      corridor: 0.085,
    },
    {
      id: "diagonal",
      title: "ななめに すーっ",
      hint: "①から 🏁まで まっすぐ なぞろう",
      points: interpolatePolyline([
        { x: 0.18, y: 0.82 },
        { x: 0.82, y: 0.18 },
      ]),
      corridor: 0.085,
    },
    {
      id: "gentle-wave",
      title: "ゆるい なみ",
      hint: "みちの まんなかを なぞろう",
      points: createWave(1.5, 0.13),
      corridor: 0.09,
    },
    {
      id: "arch",
      title: "おおきな やま",
      hint: "①から やまを こえて 🏁へ",
      points: interpolatePolyline([
        { x: 0.16, y: 0.76 },
        { x: 0.28, y: 0.42 },
        { x: 0.5, y: 0.2 },
        { x: 0.72, y: 0.42 },
        { x: 0.84, y: 0.76 },
      ]),
      corridor: 0.09,
    },
  ];

  const normal: Exercise[] = [
    {
      id: "wave",
      title: "くねくね なみ",
      hint: "なみから はみださないように なぞろう",
      points: createWave(2.5, 0.2),
      corridor: 0.075,
    },
    {
      id: "zigzag",
      title: "ぎざぎざ やま",
      hint: "かどで とまって むきを かえよう",
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
    {
      id: "s-curve",
      title: "Sの みち",
      hint: "くるっと むきを かえながら なぞろう",
      points: createSCurve(),
      corridor: 0.075,
    },
    {
      id: "circle",
      title: "まるを ぐるっと",
      hint: "①から ひとまわりして 🏁へ",
      points: createCircle(0.31),
      corridor: 0.075,
    },
    {
      id: "steps",
      title: "かいだんの みち",
      hint: "まっすぐと かどを つかいわけよう",
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
  ];

  const hard: Exercise[] = [
    {
      id: "triangle",
      title: "さんかく",
      hint: "3つの かどを ていねいに なぞろう",
      points: interpolatePolyline([
        { x: 0.5, y: 0.14 },
        { x: 0.84, y: 0.8 },
        { x: 0.16, y: 0.8 },
        { x: 0.5, y: 0.14 },
      ]),
      corridor: 0.065,
    },
    {
      id: "square",
      title: "しかく",
      hint: "4つの かどで むきを かえよう",
      points: interpolatePolyline([
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
        { x: 0.2, y: 0.2 },
      ]),
      corridor: 0.065,
    },
    {
      id: "spiral",
      title: "ぐるぐる うずまき",
      hint: "まんなかから そとへ ひろげよう",
      points: createSpiral(),
      corridor: 0.06,
    },
    {
      id: "small-wave",
      title: "こまかい なみ",
      hint: "ちいさな うごきを くりかえそう",
      points: createWave(4, 0.18),
      corridor: 0.06,
    },
    {
      id: "diamond",
      title: "ひしがた",
      hint: "4つの かどを つないで もどろう",
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

  return level === "easy" ? easy : level === "normal" ? normal : hard;
}

class PencilPracticeGame {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly portalPath: string;
  private readonly state: PracticeState = {
    level: "easy",
    screen: "start",
    exerciseIndex: 0,
    exercises: [],
    scores: [],
    passed: 0,
    strokes: [],
    currentStroke: [],
    drawing: false,
    locked: false,
  };

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "pencil-practice-experience";
    this.root.className = "pencil-practice-experience hidden";
    this.root.setAttribute("aria-label", "えんぴつれんしゅう");
    this.root.innerHTML = this.template();
    main.appendChild(this.root);

    this.canvas = this.node<HTMLCanvasElement>("canvas");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    this.context = context;
    this.bindEvents();
  }

  init(): void {
    this.decorateLearningPath();
    this.bindPortalCard();
    window.addEventListener("popstate", () => {
      window.requestAnimationFrame(() => this.syncFromLocation());
    });
    this.syncFromLocation();
  }

  private template(): string {
    return `
      <div class="pencil-practice-shell">
        <header class="pencil-practice-header">
          <div>
            <p class="pencil-practice-step">STEP 7</p>
            <h2>🖍️ えんぴつれんしゅう</h2>
          </div>
          <button type="button" class="pencil-practice-back" data-role="back-portal" aria-label="学びの一覧にもどる">
            🏠 いちらん
          </button>
        </header>

        <section class="pencil-practice-screen is-active" data-role="start-screen">
          <div class="pencil-practice-hero" aria-hidden="true">✏️〰️🏁</div>
          <h3>せんを ゆっくり なぞろう</h3>
          <p class="pencil-practice-limit">✅ 1セット 5もんで おしまい</p>
          <div class="pencil-practice-levels">
            <button type="button" data-role="start-easy">🐣 やさしい<br><small>まっすぐ・おおきな せん</small></button>
            <button type="button" data-role="start-normal">🦁 ふつう<br><small>なみ・ぎざぎざ・まる</small></button>
            <button type="button" data-role="start-hard">🚀 むずかしい<br><small>ずけい・うずまき・こまかい せん</small></button>
          </div>
          <button type="button" class="pencil-practice-sub" data-role="open-history">📊 きろくを みる</button>
        </section>

        <section class="pencil-practice-screen" data-role="game-screen">
          <div class="pencil-practice-progress">
            <strong data-role="progress-text">1 / 5</strong>
            <div class="pencil-practice-progress-track" aria-label="問題の進み具合">
              <div class="pencil-practice-progress-fill" data-role="progress-fill"></div>
            </div>
          </div>
          <h3 data-role="exercise-title">よこに すーっ</h3>
          <p class="pencil-practice-hint" data-role="exercise-hint"></p>
          <div class="pencil-practice-canvas-wrap">
            <canvas data-role="canvas" width="640" height="640" aria-label="線をなぞる場所"></canvas>
          </div>
          <div class="pencil-practice-feedback hidden" data-role="feedback" aria-live="polite"></div>
          <div class="pencil-practice-game-actions">
            <button type="button" data-role="clear">🧹 やりなおす</button>
            <button type="button" class="pencil-practice-primary" data-role="done">💮 できた！</button>
          </div>
        </section>

        <section class="pencil-practice-screen" data-role="history-screen">
          <h3>📊 これまでの きろく</h3>
          <div class="pencil-practice-history" data-role="history-list"></div>
          <div class="pencil-practice-actions">
            <button type="button" data-role="history-back">↩️ もどる</button>
            <button type="button" class="pencil-practice-danger" data-role="history-clear">🗑️ けす</button>
          </div>
        </section>

        <section class="pencil-practice-screen" data-role="result-screen">
          <div class="pencil-practice-finish" aria-hidden="true">🏁</div>
          <h3>5もん おしまい！</h3>
          <div class="pencil-practice-result-card">
            <div class="pencil-practice-stars" data-role="result-stars">⭐</div>
            <strong data-role="result-score">0</strong><span>てん</span>
            <p data-role="result-detail"></p>
          </div>
          <button type="button" class="pencil-practice-primary pencil-practice-menu" data-role="result-back">🎮 メニューへ</button>
        </section>
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
    this.node<HTMLButtonElement>("history-clear").addEventListener("click", () => this.clearHistory());
    this.node<HTMLButtonElement>("result-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("clear").addEventListener("click", () => this.clearDrawing());
    this.node<HTMLButtonElement>("done").addEventListener("click", () => this.finishExercise());

    this.canvas.addEventListener("pointerdown", (event) => this.beginStroke(event));
    this.canvas.addEventListener("pointermove", (event) => this.moveStroke(event));
    this.canvas.addEventListener("pointerup", (event) => this.endStroke(event));
    this.canvas.addEventListener("pointercancel", (event) => this.endStroke(event));
    this.canvas.addEventListener("pointerleave", (event) => {
      if (this.state.drawing && event.pointerType === "mouse") this.endStroke(event);
    });
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.pencilPracticeBound === "true") return;
    list.dataset.pencilPracticeBound = "true";
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

  private decorateLearningPath(): void {
    const list = document.getElementById("content-list");
    if (!list) return;

    const noteId = "learning-path-note";
    let note = document.getElementById(noteId);
    if (!note) {
      note = document.createElement("div");
      note.id = noteId;
      note.className = "learning-path-note";
      list.before(note);
    }
    note.innerHTML =
      "<strong>⬇️ うえから じゅんばんに やってみよう</strong><span>みる → おぼえる → かず → ならび → くらべる → とけい → せん → かく</span>";

    const categories: Record<string, string> = {
      "fit-shape": "shape",
      flashcard: "memory",
      dotburst: "math",
      "number-sequence": "math",
      "larger-number": "math",
      "clock-reading": "math",
      [CONTENT_ID]: "language",
      kakitori: "language",
    };
    const icons: Record<string, string> = {
      "fit-shape": "🧩",
      flashcard: "🧠",
      dotburst: "🟡",
      "number-sequence": "🔢",
      "larger-number": "⚖️",
      "clock-reading": "🕐",
      [CONTENT_ID]: "🖍️",
      kakitori: "✏️",
    };

    PATH_ORDER.forEach((contentId, index) => {
      const card = list.querySelector<HTMLElement>(`[data-content-id="${contentId}"]`);
      if (!card) return;
      list.appendChild(card);
      card.dataset.learningStep = String(index + 1);
      card.dataset.category = categories[contentId] ?? "memory";
      const icon = card.querySelector<HTMLElement>(".content-icon");
      if (icon) icon.textContent = icons[contentId] ?? "🎮";

      const top = card.querySelector<HTMLElement>(".content-card-top");
      if (!top) return;
      let badge = top.querySelector<HTMLElement>(".content-step-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "content-step-badge";
        top.appendChild(badge);
      }
      badge.textContent = `STEP ${index + 1}`;
    });

    const counter = document.querySelector<HTMLElement>(".portal-content-count");
    if (counter) {
      counter.setAttribute("aria-label", "8つの学習コンテンツ");
      counter.innerHTML = '<span aria-hidden="true">🎮</span><span>8つ</span>';
    }
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.resetPointerState();
    window.history.pushState(null, "", this.portalPath);
    this.root.classList.add("hidden");
    document.getElementById("view-portal")?.classList.remove("hidden");
  }

  private syncFromLocation(): void {
    if (this.isCurrentPath()) {
      this.showExperience();
    } else {
      this.root.classList.add("hidden");
      this.resetPointerState();
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
    this.state.level = level;
    this.state.exerciseIndex = 0;
    this.state.exercises = this.shuffle(createExercisePool(level)).slice(0, EXERCISE_COUNT);
    this.state.scores = [];
    this.state.passed = 0;
    this.state.locked = false;
    this.showScreen("game");
    this.prepareExercise();
  }

  private prepareExercise(): void {
    this.state.strokes = [];
    this.state.currentStroke = [];
    this.state.drawing = false;
    this.state.locked = false;
    const exercise = this.currentExercise();
    if (!exercise) {
      this.endSession();
      return;
    }

    this.node<HTMLElement>("exercise-title").textContent = exercise.title;
    this.node<HTMLElement>("exercise-hint").textContent = exercise.hint;
    this.node<HTMLElement>("progress-text").textContent = `${this.state.exerciseIndex + 1} / ${EXERCISE_COUNT}`;
    this.node<HTMLElement>("progress-fill").style.width = `${((this.state.exerciseIndex + 1) / EXERCISE_COUNT) * 100}%`;
    this.hideFeedback();
    this.renderCanvas();
  }

  private beginStroke(event: PointerEvent): void {
    if (this.state.screen !== "game" || this.state.locked) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.state.drawing = true;
    this.state.currentStroke = [this.eventPoint(event)];
    this.renderCanvas();
  }

  private moveStroke(event: PointerEvent): void {
    if (!this.state.drawing || this.state.locked) return;
    event.preventDefault();
    this.appendInterpolatedPoint(this.eventPoint(event));
    this.renderCanvas();
  }

  private endStroke(event: PointerEvent): void {
    if (!this.state.drawing) return;
    event.preventDefault();
    this.appendInterpolatedPoint(this.eventPoint(event));
    if (this.state.currentStroke.length > 1) {
      this.state.strokes.push(this.state.currentStroke.map((point) => ({ ...point })));
    }
    this.state.currentStroke = [];
    this.state.drawing = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.renderCanvas();
  }

  private appendInterpolatedPoint(point: Point): void {
    const previous = this.state.currentStroke[this.state.currentStroke.length - 1];
    if (!previous) {
      this.state.currentStroke.push(point);
      return;
    }
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const segments = Math.max(1, Math.ceil(distance / 0.012));
    for (let index = 1; index <= segments; index += 1) {
      const ratio = index / segments;
      this.state.currentStroke.push({
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
      });
    }
  }

  private clearDrawing(): void {
    if (this.state.locked) return;
    this.state.strokes = [];
    this.state.currentStroke = [];
    this.state.drawing = false;
    this.hideFeedback();
    this.renderCanvas();
  }

  private finishExercise(): void {
    if (this.state.locked) return;
    const drawnPoints = [...this.state.strokes.flat(), ...this.state.currentStroke];
    if (drawnPoints.length < 4) {
      this.showFeedback("✏️ せんを かいてから『できた！』を おしてね", false);
      return;
    }

    const exercise = this.currentExercise();
    if (!exercise) return;
    this.state.locked = true;
    const score = this.evaluateTrace(exercise, drawnPoints);
    const threshold = this.state.level === "easy" ? 55 : this.state.level === "normal" ? 60 : 65;
    const passed = score >= threshold;
    this.state.scores.push(score);
    if (passed) this.state.passed += 1;

    if (passed) {
      audioService.playTone({ frequency: 740, sweepToFrequency: 1100, gain: 0.1, durationMs: 240 });
      this.showFeedback(`💮 できた！ ${score}てん`, true);
    } else {
      audioService.playTone({ frequency: 260, type: "triangle", gain: 0.07, durationMs: 220 });
      this.showFeedback(`👍 さいごまで かけた！ ${score}てん`, true);
    }

    window.setTimeout(() => {
      this.state.exerciseIndex += 1;
      if (this.state.exerciseIndex >= EXERCISE_COUNT) {
        this.endSession();
      } else {
        this.prepareExercise();
      }
    }, 700);
  }

  private evaluateTrace(exercise: Exercise, drawnPoints: Point[]): number {
    const guide = exercise.points;
    const corridor = exercise.corridor;
    const covered = guide.filter((guidePoint) =>
      drawnPoints.some((drawnPoint) => Math.hypot(guidePoint.x - drawnPoint.x, guidePoint.y - drawnPoint.y) <= corridor),
    ).length;
    const coverageRatio = guide.length === 0 ? 0 : covered / guide.length;
    const firstDrawn = drawnPoints[0];
    const lastDrawn = drawnPoints[drawnPoints.length - 1];
    const firstGuide = guide[0];
    const lastGuide = guide[guide.length - 1];
    const endpointTolerance = corridor * 1.8;
    const startOk =
      firstDrawn && firstGuide
        ? Math.hypot(firstDrawn.x - firstGuide.x, firstDrawn.y - firstGuide.y) <= endpointTolerance
        : false;
    const goalOk =
      lastDrawn && lastGuide
        ? Math.hypot(lastDrawn.x - lastGuide.x, lastDrawn.y - lastGuide.y) <= endpointTolerance
        : false;
    return Math.round(Math.min(100, coverageRatio * 80 + (startOk ? 10 : 0) + (goalOk ? 10 : 0)));
  }

  private endSession(): void {
    const average = this.averageScore();
    this.node<HTMLElement>("result-score").textContent = String(average);
    this.node<HTMLElement>("result-detail").textContent = `${this.levelLabel(this.state.level)} ・ ${this.state.passed}/${EXERCISE_COUNT}もん よく なぞれた`;
    this.node<HTMLElement>("result-stars").textContent = average >= 80 ? "⭐⭐⭐" : average >= 60 ? "⭐⭐" : "⭐";
    this.saveHistory(average);
    this.showScreen("result");
  }

  private renderCanvas(): void {
    const exercise = this.currentExercise();
    if (!exercise) return;
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(document.body);
    const surface = style.getPropertyValue("--app-surface").trim() || "#ffffff";
    const text = style.getPropertyValue("--app-heading").trim() || "#0f172a";
    const primary = style.getPropertyValue("--app-primary").trim() || "#f97316";
    const secondary = style.getPropertyValue("--app-secondary").trim() || "#2563eb";

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, width, height);
    this.drawPath(exercise.points, "rgba(148, 163, 184, 0.28)", exercise.corridor * width * 2, false);
    this.drawPath(exercise.points, "rgba(100, 116, 139, 0.8)", Math.max(5, width * 0.01), true);

    const start = exercise.points[0];
    const goal = exercise.points[exercise.points.length - 1];
    if (start) this.drawMarker(start, "①", primary, text);
    if (goal) this.drawMarker(goal, "🏁", secondary, text);

    [...this.state.strokes, this.state.currentStroke].forEach((stroke) => {
      if (stroke.length > 1) this.drawPath(stroke, primary, Math.max(12, width * 0.026), false);
    });
  }

  private drawPath(points: Point[], color: string, lineWidth: number, dashed: boolean): void {
    if (points.length < 2) return;
    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    const first = points[0];
    if (!first) return;
    ctx.moveTo(first.x * this.canvas.width, first.y * this.canvas.height);
    points.slice(1).forEach((point) => ctx.lineTo(point.x * this.canvas.width, point.y * this.canvas.height));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashed ? [14, 12] : []);
    ctx.stroke();
    ctx.restore();
  }

  private drawMarker(point: Point, label: string, fill: string, text: string): void {
    const ctx = this.context;
    const x = point.x * this.canvas.width;
    const y = point.y * this.canvas.height;
    const radius = this.canvas.width * 0.045;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.font = `bold ${Math.round(radius * 1.05)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = text;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private eventPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  private showHistory(): void {
    this.renderHistory();
    this.showScreen("history");
  }

  private loadHistory(): PracticeHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is PracticeHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<PracticeHistoryRecord>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          (row.level === "easy" || row.level === "normal" || row.level === "hard") &&
          typeof row.levelLabel === "string" &&
          typeof row.averageScore === "number" &&
          typeof row.passed === "number" &&
          typeof row.total === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private saveHistory(averageScore: number): void {
    try {
      const now = new Date();
      const history = this.loadHistory();
      history.unshift({
        id: Date.now(),
        date: `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
        level: this.state.level,
        levelLabel: this.levelLabel(this.state.level),
        averageScore,
        passed: this.state.passed,
        total: EXERCISE_COUNT,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch {
      // 保存できなくても学習は継続する。
    }
  }

  private renderHistory(): void {
    const history = this.loadHistory();
    const list = this.node<HTMLElement>("history-list");
    if (history.length === 0) {
      list.innerHTML = '<p class="pencil-practice-empty">まだ きろくが ないよ</p>';
      return;
    }
    list.innerHTML = history
      .map(
        (row) => `
          <article class="pencil-practice-history-item">
            <div><strong>${row.levelLabel}</strong><span>${row.date}</span></div>
            <p>${row.passed}/${row.total}もん</p>
            <b>${row.averageScore}てん</b>
          </article>
        `,
      )
      .join("");
  }

  private clearHistory(): void {
    if (!window.confirm("えんぴつれんしゅうの きろくを ぜんぶ けす？")) return;
    localStorage.removeItem(STORAGE_KEY);
    this.renderHistory();
  }

  private showFeedback(message: string, positive: boolean): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-positive", "is-notice");
    feedback.classList.add(positive ? "is-positive" : "is-notice");
  }

  private hideFeedback(): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.classList.add("hidden");
    feedback.classList.remove("is-positive", "is-notice");
  }

  private showScreen(screen: Screen): void {
    this.state.screen = screen;
    this.node<HTMLElement>("start-screen").classList.toggle("is-active", screen === "start");
    this.node<HTMLElement>("game-screen").classList.toggle("is-active", screen === "game");
    this.node<HTMLElement>("history-screen").classList.toggle("is-active", screen === "history");
    this.node<HTMLElement>("result-screen").classList.toggle("is-active", screen === "result");
    if (screen !== "game") this.resetPointerState();
  }

  private resetPointerState(): void {
    this.state.drawing = false;
    this.state.currentStroke = [];
  }

  private currentExercise(): Exercise | null {
    return this.state.exercises[this.state.exerciseIndex] ?? null;
  }

  private averageScore(): number {
    if (this.state.scores.length === 0) return 0;
    return Math.round(this.state.scores.reduce((sum, score) => sum + score, 0) / this.state.scores.length);
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex] as T, copy[index] as T];
    }
    return copy;
  }

  private levelLabel(level: PracticeLevel): string {
    if (level === "easy") return "やさしい";
    if (level === "normal") return "ふつう";
    return "むずかしい";
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing pencil-practice node: ${role}`);
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

function initPencilPractice(): void {
  const game = new PencilPracticeGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPencilPractice, { once: true });
} else {
  initPencilPractice();
}
