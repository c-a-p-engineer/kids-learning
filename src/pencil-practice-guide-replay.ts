import "./styles/pencil-practice-flow.scss";

import {
  GUIDE_MAP,
  REPLAY_KEY,
  STRICT_KEY,
  loadArray,
  type GuideDefinition,
  type Point,
  type StrictExerciseResult,
  type StrictSessionResult,
  type TimedPoint,
} from "./pencil-practice-guide-data";

interface ReplayExercise {
  title: string;
  strokes: TimedPoint[][];
}

interface ReplaySession {
  historyId: number;
  date: string;
  levelLabel: string;
  exercises: ReplayExercise[];
}

const ROOT_ID = "pencil-practice-experience";
const CANVAS_SIZE = 640;

class PencilPracticeGuideReplay {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly replayCanvas: HTMLCanvasElement;
  private readonly replayContext: CanvasRenderingContext2D;
  private activeReplay: ReplaySession | null = null;
  private replayRunId = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.insertAdjacentHTML("beforeend", this.overlayTemplate());
    const overlay = root.querySelector<HTMLElement>('[data-flow-role="overlay"]');
    const replayCanvas = root.querySelector<HTMLCanvasElement>('[data-flow-role="canvas"]');
    const replayContext = replayCanvas?.getContext("2d");
    if (!overlay || !replayCanvas || !replayContext) throw new Error("Missing guide replay controls");
    this.overlay = overlay;
    this.replayCanvas = replayCanvas;
    this.replayContext = replayContext;
    this.bindEvents();
  }

  private overlayTemplate(): string {
    return `
      <div class="pencil-flow-overlay hidden" data-flow-role="overlay" aria-hidden="true">
        <div class="pencil-flow-panel" role="dialog" aria-modal="true" aria-labelledby="pencil-flow-title">
          <div class="pencil-flow-heading">
            <div>
              <p data-flow-role="progress">1 / 5</p>
              <h3 id="pencil-flow-title" data-flow-role="title">どうが さいせい</h3>
            </div>
            <button type="button" data-flow-role="close" aria-label="動画を閉じる">✖️ とじる</button>
          </div>
          <p class="pencil-flow-guide-note">灰色の道がお手本、オレンジの線が描いた線です。</p>
          <div class="pencil-flow-canvas-wrap">
            <canvas data-flow-role="canvas" width="640" height="640" aria-label="お手本と描いた線の再生画面"></canvas>
          </div>
          <p class="pencil-flow-status" data-flow-role="status" aria-live="polite"></p>
          <div class="pencil-flow-actions">
            <button type="button" data-flow-role="again">🔁 もういちど</button>
            <button type="button" data-flow-role="download">⬇️ どうがを ほぞん</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => this.handleRootClick(event), true);
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.closeReplay();
    });
    this.button("close").addEventListener("click", () => this.closeReplay());
    this.button("again").addEventListener("click", () => this.replayActive());
    this.button("download").addEventListener("click", () => void this.downloadActive());
  }

  private handleRootClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const resultReplay = target.closest<HTMLButtonElement>('[data-video-role="result-replay"]');
    if (resultReplay && !resultReplay.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const session = this.loadReplays()[0];
      if (session) this.openReplay(session);
      return;
    }
    const historyAction = target.closest<HTMLButtonElement>("[data-video-action]");
    if (!historyAction || historyAction.disabled) return;
    const historyId = Number.parseInt(historyAction.dataset.historyId ?? "", 10);
    const session = this.loadReplays().find((row) => row.historyId === historyId);
    if (!session) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (historyAction.dataset.videoAction === "replay") this.openReplay(session);
    if (historyAction.dataset.videoAction === "download") void this.downloadSession(session);
  }

  private openReplay(session: ReplaySession): void {
    this.activeReplay = session;
    this.overlay.classList.remove("hidden");
    this.overlay.setAttribute("aria-hidden", "false");
    void this.playSession(session);
  }

  private closeReplay(): void {
    this.replayRunId += 1;
    this.activeReplay = null;
    this.overlay.classList.add("hidden");
    this.overlay.setAttribute("aria-hidden", "true");
  }

  private replayActive(): void {
    if (this.activeReplay) void this.playSession(this.activeReplay);
  }

  private async playSession(session: ReplaySession): Promise<void> {
    const runId = ++this.replayRunId;
    const strict = this.loadStrictSessions().find((row) => row.historyId === session.historyId);
    this.text("status", "お手本と かいた線を さいせいしています");
    for (let index = 0; index < session.exercises.length; index += 1) {
      if (runId !== this.replayRunId) return;
      const exercise = session.exercises[index];
      if (!exercise) continue;
      this.text("title", exercise.title);
      this.text("progress", `${index + 1} / ${session.exercises.length}`);
      await this.animateExercise(
        exercise,
        strict?.exercises[index],
        this.replayContext,
        this.replayCanvas,
        () => runId === this.replayRunId,
      );
      await this.wait(350);
    }
    if (runId === this.replayRunId) this.text("status", "🏁 さいせい おしまい");
  }

  private async animateExercise(
    exercise: ReplayExercise,
    result: StrictExerciseResult | undefined,
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    shouldContinue: () => boolean,
  ): Promise<void> {
    const guide = GUIDE_MAP.get(exercise.title);
    this.drawReplayBase(context, canvas, guide, exercise);
    await this.wait(180);
    if (result?.skipped) {
      this.drawCenteredLabel(context, canvas, "⏭️ スキップ");
      await this.wait(500);
      return;
    }
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

  private drawReplayBase(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    guide: GuideDefinition | undefined,
    exercise: ReplayExercise,
  ): void {
    const style = getComputedStyle(document.body);
    const surface = style.getPropertyValue("--app-surface").trim() || "#ffffff";
    const heading = style.getPropertyValue("--app-heading").trim() || "#0f172a";
    const primary = style.getPropertyValue("--app-primary").trim() || "#f97316";
    const secondary = style.getPropertyValue("--app-secondary").trim() || "#2563eb";
    context.fillStyle = surface;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (guide) {
      this.drawPath(context, canvas, guide.points, "rgba(148, 163, 184, 0.3)", guide.corridor * canvas.width * 2, false);
      this.drawPath(context, canvas, guide.points, "rgba(71, 85, 105, 0.9)", Math.max(5, canvas.width * 0.01), true);
      const start = guide.points[0];
      const goal = guide.points[guide.points.length - 1];
      if (start) this.drawMarker(context, canvas, start, "①", primary, heading);
      if (goal) this.drawMarker(context, canvas, goal, "🏁", secondary, heading);
      return;
    }
    const allPoints = exercise.strokes.flat();
    const first = allPoints[0];
    const last = allPoints[allPoints.length - 1];
    if (first) this.drawMarker(context, canvas, first, "①", primary, heading);
    if (last) this.drawMarker(context, canvas, last, "🏁", secondary, heading);
  }

  private drawPath(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    points: Point[],
    color: string,
    width: number,
    dashed: boolean,
  ): void {
    const first = points[0];
    if (!first || points.length < 2) return;
    context.save();
    context.beginPath();
    context.moveTo(first.x * canvas.width, first.y * canvas.height);
    points.slice(1).forEach((point) => context.lineTo(point.x * canvas.width, point.y * canvas.height));
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash(dashed ? [14, 12] : []);
    context.stroke();
    context.restore();
  }

  private drawMarker(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    point: Point,
    label: string,
    fill: string,
    text: string,
  ): void {
    const x = point.x * canvas.width;
    const y = point.y * canvas.height;
    const radius = canvas.width * 0.045;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.font = `bold ${Math.round(radius * 1.05)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = text;
    context.fillText(label, x, y);
    context.restore();
  }

  private drawCenteredLabel(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, label: string): void {
    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fillRect(canvas.width * 0.2, canvas.height * 0.42, canvas.width * 0.6, canvas.height * 0.16);
    context.fillStyle = "#334155";
    context.font = `bold ${Math.round(canvas.width * 0.06)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
    context.restore();
  }

  private async downloadActive(): Promise<void> {
    if (this.activeReplay) await this.downloadSession(this.activeReplay);
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
    const strict = this.loadStrictSessions().find((row) => row.historyId === session.historyId);
    const button = this.button("download");
    button.disabled = true;
    this.text("status", "お手本つき動画を つくっています");
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
      for (let index = 0; index < session.exercises.length; index += 1) {
        const exercise = session.exercises[index];
        if (!exercise) continue;
        await this.animateExercise(exercise, strict?.exercises[index], context, canvas, () => true);
        await this.wait(300);
      }
      recorder.stop();
      const blob = await complete;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pencil_practice_guide_${session.historyId}.webm`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.text("status", "✅ お手本つき動画を ほぞんしました");
    } finally {
      button.disabled = false;
    }
  }

  private loadReplays(): ReplaySession[] {
    return loadArray(REPLAY_KEY).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Partial<ReplaySession>;
      if (typeof row.historyId !== "number" || typeof row.date !== "string" || typeof row.levelLabel !== "string" || !Array.isArray(row.exercises)) return [];
      const exercises = row.exercises.flatMap((exercise) => {
        if (typeof exercise !== "object" || exercise === null) return [];
        const value = exercise as Partial<ReplayExercise>;
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
        return [{ title: value.title, strokes }];
      });
      return exercises.length > 0 ? [{ historyId: row.historyId, date: row.date, levelLabel: row.levelLabel, exercises }] : [];
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

  private videoMimeType(): string {
    return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
  }

  private button(role: string): HTMLButtonElement {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-flow-role="${role}"]`);
    if (!button) throw new Error(`Missing flow button: ${role}`);
    return button;
  }

  private text(role: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(`[data-flow-role="${role}"]`);
    if (element) element.textContent = value;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

function initPencilPracticeGuideReplay(): void {
  const attach = (): boolean => {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.guideReplayBound === "true") return false;
    root.dataset.guideReplayBound = "true";
    new PencilPracticeGuideReplay(root);
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
  document.addEventListener("DOMContentLoaded", initPencilPracticeGuideReplay, { once: true });
} else {
  initPencilPracticeGuideReplay();
}
