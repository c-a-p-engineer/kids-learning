import "./styles/pencil-practice-video.scss";

interface TimedPoint {
  x: number;
  y: number;
  t: number;
}

interface ExerciseReplay {
  title: string;
  strokes: TimedPoint[][];
}

interface ReplaySession {
  historyId: number;
  date: string;
  levelLabel: string;
  exercises: ExerciseReplay[];
}

interface ScoreHistoryRow {
  id: number;
  date: string;
  levelLabel: string;
}

const ROOT_ID = "pencil-practice-experience";
const SCORE_STORAGE_KEY = "pencil_practice_v1_history";
const REPLAY_STORAGE_KEY = "pencil_practice_v1_replays";
const MAX_REPLAY_SESSIONS = 20;
const EXERCISE_COUNT = 5;
const CANVAS_SIZE = 640;

class PencilPracticeVideo {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly replayCanvas: HTMLCanvasElement;
  private readonly replayContext: CanvasRenderingContext2D;
  private strokes: TimedPoint[][] = [];
  private currentStroke: TimedPoint[] = [];
  private sessionExercises: ExerciseReplay[] = [];
  private drawing = false;
  private exerciseStartedAt = performance.now();
  private exerciseCaptured = false;
  private activeSession: ReplaySession | null = null;
  private replayRunId = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const canvas = root.querySelector<HTMLCanvasElement>('[data-role="canvas"]');
    if (!canvas) throw new Error("Missing pencil practice canvas");
    this.canvas = canvas;
    root.insertAdjacentHTML("beforeend", this.overlayTemplate());
    const replayCanvas = root.querySelector<HTMLCanvasElement>('[data-video-role="canvas"]');
    const replayContext = replayCanvas?.getContext("2d");
    if (!replayCanvas || !replayContext) throw new Error("Missing pencil practice replay canvas");
    this.replayCanvas = replayCanvas;
    this.replayContext = replayContext;
    this.bindEvents();
    this.observeScreens();
    this.installResultButton();
    this.reconcileReplays();
  }

  private overlayTemplate(): string {
    return `
      <div class="pencil-video-overlay hidden" data-video-role="overlay" aria-hidden="true">
        <div class="pencil-video-panel" role="dialog" aria-modal="true" aria-labelledby="pencil-video-title">
          <div class="pencil-video-heading">
            <div>
              <p data-video-role="progress">1 / 5</p>
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
    this.canvas.addEventListener("pointerdown", (event) => this.beginStroke(event), { capture: true });
    this.canvas.addEventListener("pointermove", (event) => this.moveStroke(event), { capture: true });
    this.canvas.addEventListener("pointerup", (event) => this.endStroke(event), { capture: true });
    this.canvas.addEventListener("pointercancel", (event) => this.endStroke(event), { capture: true });

    this.root.querySelectorAll<HTMLButtonElement>('[data-role^="start-"]').forEach((button) => {
      button.addEventListener("click", () => this.startSession());
    });
    this.button("clear").addEventListener("click", () => this.resetExercise());
    this.button("done").addEventListener("click", () => this.captureExercise());
    this.button("open-history").addEventListener("click", () => window.setTimeout(() => this.enhanceHistory(), 0));
    this.button("history-clear").addEventListener("click", () => window.setTimeout(() => this.reconcileReplays(), 0));

    this.element("overlay").addEventListener("click", (event) => {
      if (event.target === this.element("overlay")) this.closeReplay();
    });
    this.videoButton("close").addEventListener("click", () => this.closeReplay());
    this.videoButton("again").addEventListener("click", () => this.replayActive());
    this.videoButton("download").addEventListener("click", () => void this.downloadActive());

    const historyList = this.root.querySelector<HTMLElement>('[data-role="history-list"]');
    historyList?.addEventListener("click", (event) => this.handleHistoryAction(event));
  }

  private observeScreens(): void {
    const progress = this.root.querySelector<HTMLElement>('[data-role="progress-text"]');
    if (progress) {
      new MutationObserver(() => this.resetExercise()).observe(progress, { childList: true, characterData: true, subtree: true });
    }
    const historyList = this.root.querySelector<HTMLElement>('[data-role="history-list"]');
    if (historyList) {
      new MutationObserver(() => this.enhanceHistory()).observe(historyList, { childList: true });
    }
  }

  private installResultButton(): void {
    const resultBack = this.root.querySelector<HTMLButtonElement>('[data-role="result-back"]');
    if (!resultBack || this.root.querySelector('[data-video-role="result-replay"]')) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pencil-practice-primary pencil-practice-menu pencil-video-result-button";
    button.dataset.videoRole = "result-replay";
    button.textContent = "▶️ どうがを みる";
    button.disabled = true;
    button.addEventListener("click", () => {
      const latest = this.loadReplays()[0];
      if (latest) this.openReplay(latest);
    });
    resultBack.before(button);
  }

  private startSession(): void {
    this.sessionExercises = [];
    this.resetExercise();
    this.resultReplayButton().disabled = true;
  }

  private beginStroke(event: PointerEvent): void {
    this.drawing = true;
    this.currentStroke = [this.eventPoint(event)];
  }

  private moveStroke(event: PointerEvent): void {
    if (!this.drawing) return;
    const point = this.eventPoint(event);
    const previous = this.currentStroke[this.currentStroke.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.004 || point.t - previous.t >= 16) {
      this.currentStroke.push(point);
    }
  }

  private endStroke(event: PointerEvent): void {
    if (!this.drawing) return;
    this.moveStroke(event);
    if (this.currentStroke.length > 1) this.strokes.push(this.compactStroke(this.currentStroke));
    this.currentStroke = [];
    this.drawing = false;
  }

  private resetExercise(): void {
    this.strokes = [];
    this.currentStroke = [];
    this.drawing = false;
    this.exerciseCaptured = false;
    this.exerciseStartedAt = performance.now();
  }

  private captureExercise(): void {
    if (this.exerciseCaptured) return;
    const strokes = this.completedStrokes();
    if (strokes.flat().length < 4) return;
    this.exerciseCaptured = true;
    const title = this.root.querySelector<HTMLElement>('[data-role="exercise-title"]')?.textContent?.trim() || "えんぴつれんしゅう";
    this.sessionExercises.push({ title, strokes });

    const progressText = this.root.querySelector<HTMLElement>('[data-role="progress-text"]')?.textContent ?? "";
    const exerciseNumber = Number.parseInt(progressText, 10);
    if (exerciseNumber === EXERCISE_COUNT) void this.saveCompletedSession();
  }

  private async saveCompletedSession(): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await this.wait(150);
      const latest = this.loadScoreHistory()[0];
      if (!latest) continue;
      const replays = this.loadReplays().filter((row) => row.historyId !== latest.id);
      replays.unshift({
        historyId: latest.id,
        date: latest.date,
        levelLabel: latest.levelLabel,
        exercises: this.sessionExercises.slice(0, EXERCISE_COUNT).map((exercise) => ({
          title: exercise.title,
          strokes: exercise.strokes.map((stroke) => stroke.map((point) => ({ ...point }))),
        })),
      });
      this.saveReplays(replays.slice(0, MAX_REPLAY_SESSIONS));
      this.resultReplayButton().disabled = false;
      return;
    }
  }

  private completedStrokes(): TimedPoint[][] {
    const strokes = this.strokes.map((stroke) => stroke.map((point) => ({ ...point })));
    if (this.currentStroke.length > 1) strokes.push(this.compactStroke(this.currentStroke));
    return strokes;
  }

  private compactStroke(stroke: TimedPoint[]): TimedPoint[] {
    const compact: TimedPoint[] = [];
    stroke.forEach((point, index) => {
      const previous = compact[compact.length - 1];
      const endpoint = index === 0 || index === stroke.length - 1;
      if (endpoint || !previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.006 || point.t - previous.t >= 24) {
        compact.push({
          x: Math.round(point.x * 10000) / 10000,
          y: Math.round(point.y * 10000) / 10000,
          t: Math.round(point.t),
        });
      }
    });
    return compact;
  }

  private eventPoint(event: PointerEvent): TimedPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      t: Math.max(0, performance.now() - this.exerciseStartedAt),
    };
  }

  private enhanceHistory(): void {
    const history = this.loadScoreHistory();
    const replayMap = new Map(this.loadReplays().map((row) => [row.historyId, row]));
    const articles = this.root.querySelectorAll<HTMLElement>('[data-role="history-list"] .pencil-practice-history-item');
    articles.forEach((article, index) => {
      const score = history[index];
      if (!score || article.dataset.videoEnhanced === String(score.id)) return;
      article.dataset.videoEnhanced = String(score.id);
      article.querySelector(".pencil-video-history-actions")?.remove();
      const actions = document.createElement("div");
      actions.className = "pencil-video-history-actions";
      const available = replayMap.has(score.id);
      actions.innerHTML = `
        <button type="button" data-video-action="replay" data-history-id="${score.id}" ${available ? "" : "disabled"}>
          ${available ? "▶️ どうが" : "どうがなし"}
        </button>
        <button type="button" data-video-action="download" data-history-id="${score.id}" ${available ? "" : "disabled"}>⬇️ ほぞん</button>
      `;
      article.appendChild(actions);
    });
  }

  private handleHistoryAction(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>("[data-video-action]");
    if (!button || button.disabled) return;
    const historyId = Number.parseInt(button.dataset.historyId ?? "", 10);
    const session = this.loadReplays().find((row) => row.historyId === historyId);
    if (!session) return;
    if (button.dataset.videoAction === "replay") this.openReplay(session);
    if (button.dataset.videoAction === "download") void this.downloadSession(session);
  }

  private openReplay(session: ReplaySession): void {
    this.activeSession = session;
    const overlay = this.element("overlay");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    void this.playSession(session);
  }

  private closeReplay(): void {
    this.replayRunId += 1;
    this.activeSession = null;
    const overlay = this.element("overlay");
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  private replayActive(): void {
    if (this.activeSession) void this.playSession(this.activeSession);
  }

  private async playSession(session: ReplaySession): Promise<void> {
    const runId = ++this.replayRunId;
    this.text("status", "どうがを さいせいしています");
    for (let index = 0; index < session.exercises.length; index += 1) {
      if (runId !== this.replayRunId) return;
      const exercise = session.exercises[index];
      if (!exercise) continue;
      this.text("title", exercise.title);
      this.text("progress", `${index + 1} / ${session.exercises.length}`);
      await this.animateExercise(exercise, this.replayContext, this.replayCanvas, () => runId === this.replayRunId);
      await this.wait(350);
    }
    if (runId === this.replayRunId) this.text("status", "🏁 さいせい おしまい");
  }

  private async animateExercise(
    exercise: ExerciseReplay,
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    shouldContinue: () => boolean,
  ): Promise<void> {
    this.drawReplayBase(context, canvas, exercise);
    await this.wait(180);
    context.save();
    context.strokeStyle = getComputedStyle(document.body).getPropertyValue("--app-primary").trim() || "#f97316";
    context.lineWidth = Math.max(12, canvas.width * 0.026);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of exercise.strokes) {
      const first = stroke[0];
      if (!first || stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(first.x * canvas.width, first.y * canvas.height);
      for (let index = 1; index < stroke.length; index += 1) {
        if (!shouldContinue()) {
          context.restore();
          return;
        }
        const point = stroke[index];
        const previous = stroke[index - 1];
        if (!point || !previous) continue;
        context.lineTo(point.x * canvas.width, point.y * canvas.height);
        context.stroke();
        await this.wait(Math.max(4, Math.min(point.t - previous.t, 50)));
      }
      await this.wait(160);
    }
    context.restore();
  }

  private drawReplayBase(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, exercise: ExerciseReplay): void {
    const style = getComputedStyle(document.body);
    const surface = style.getPropertyValue("--app-surface").trim() || "#ffffff";
    const subtext = style.getPropertyValue("--app-subtext").trim() || "#64748b";
    context.fillStyle = surface;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(148, 163, 184, 0.2)";
    context.lineWidth = 1;
    for (let value = canvas.width / 4; value < canvas.width; value += canvas.width / 4) {
      context.beginPath();
      context.moveTo(value, 0);
      context.lineTo(value, canvas.height);
      context.stroke();
      context.beginPath();
      context.moveTo(0, value);
      context.lineTo(canvas.width, value);
      context.stroke();
    }
    const allPoints = exercise.strokes.flat();
    const first = allPoints[0];
    const last = allPoints[allPoints.length - 1];
    context.fillStyle = subtext;
    context.font = `bold ${Math.round(canvas.width * 0.045)}px sans-serif`;
    if (first) context.fillText("①", first.x * canvas.width - 18, first.y * canvas.height - 18);
    if (last) context.fillText("🏁", last.x * canvas.width + 8, last.y * canvas.height - 8);
  }

  private async downloadActive(): Promise<void> {
    if (this.activeSession) await this.downloadSession(this.activeSession);
  }

  private async downloadSession(session: ReplaySession): Promise<void> {
    if (typeof MediaRecorder === "undefined") {
      window.alert("このブラウザは動画保存に対応していません。画面での再生は利用できます。");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.captureStream !== "function") {
      window.alert("このブラウザは動画保存に対応していません。画面での再生は利用できます。");
      return;
    }
    const downloadButton = this.videoButton("download");
    downloadButton.disabled = true;
    this.text("status", "どうがを つくっています");
    try {
      const mimeType = this.videoMimeType();
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType });
      const chunks: BlobPart[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      const complete = new Promise<Blob>((resolve) => {
        recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
      });
      recorder.start();
      for (const exercise of session.exercises) {
        await this.animateExercise(exercise, context, canvas, () => true);
        await this.wait(300);
      }
      recorder.stop();
      const blob = await complete;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pencil_practice_${session.historyId}.webm`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.text("status", "✅ どうがを ほぞんしました");
    } finally {
      downloadButton.disabled = false;
    }
  }

  private videoMimeType(): string {
    return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
  }

  private reconcileReplays(): void {
    const validIds = new Set(this.loadScoreHistory().map((row) => row.id));
    const replays = this.loadReplays().filter((row) => validIds.has(row.historyId));
    this.saveReplays(replays);
    this.enhanceHistory();
  }

  private loadScoreHistory(): ScoreHistoryRow[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const row = item as Partial<ScoreHistoryRow>;
        if (typeof row.id !== "number" || typeof row.date !== "string" || typeof row.levelLabel !== "string") return [];
        return [{ id: row.id, date: row.date, levelLabel: row.levelLabel }];
      });
    } catch {
      return [];
    }
  }

  private loadReplays(): ReplaySession[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(REPLAY_STORAGE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const row = item as Partial<ReplaySession>;
        if (typeof row.historyId !== "number" || typeof row.date !== "string" || typeof row.levelLabel !== "string" || !Array.isArray(row.exercises)) return [];
        const exercises = row.exercises.flatMap((exercise) => {
          if (typeof exercise !== "object" || exercise === null) return [];
          const value = exercise as Partial<ExerciseReplay>;
          if (typeof value.title !== "string" || !Array.isArray(value.strokes)) return [];
          const strokes = value.strokes.flatMap((stroke) => {
            if (!Array.isArray(stroke)) return [];
            const points = stroke.flatMap((point) => {
              if (typeof point !== "object" || point === null) return [];
              const p = point as Partial<TimedPoint>;
              if (typeof p.x !== "number" || typeof p.y !== "number" || typeof p.t !== "number") return [];
              return [{ x: p.x, y: p.y, t: p.t }];
            });
            return points.length > 1 ? [points] : [];
          });
          return strokes.length > 0 ? [{ title: value.title, strokes }] : [];
        });
        return exercises.length > 0 ? [{ historyId: row.historyId, date: row.date, levelLabel: row.levelLabel, exercises }] : [];
      });
    } catch {
      return [];
    }
  }

  private saveReplays(replays: ReplaySession[]): void {
    try {
      localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replays.slice(0, MAX_REPLAY_SESSIONS)));
    } catch {
      try {
        localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replays.slice(0, 5)));
      } catch {
        // 動画データを保存できなくても学習は継続する。
      }
    }
  }

  private resultReplayButton(): HTMLButtonElement {
    const button = this.root.querySelector<HTMLButtonElement>('[data-video-role="result-replay"]');
    if (!button) throw new Error("Missing result replay button");
    return button;
  }

  private button(role: string): HTMLButtonElement {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);
    if (!button) throw new Error(`Missing pencil practice button: ${role}`);
    return button;
  }

  private videoButton(role: string): HTMLButtonElement {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-video-role="${role}"]`);
    if (!button) throw new Error(`Missing pencil video button: ${role}`);
    return button;
  }

  private element(role: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`[data-video-role="${role}"]`);
    if (!element) throw new Error(`Missing pencil video element: ${role}`);
    return element;
  }

  private text(role: string, value: string): void {
    this.element(role).textContent = value;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

function initPencilPracticeVideo(): void {
  const attach = (): boolean => {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.videoReplayBound === "true") return false;
    root.dataset.videoReplayBound = "true";
    new PencilPracticeVideo(root);
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
  document.addEventListener("DOMContentLoaded", initPencilPracticeVideo, { once: true });
} else {
  initPencilPracticeVideo();
}
