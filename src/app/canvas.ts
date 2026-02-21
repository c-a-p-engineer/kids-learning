import { CANVAS_SIZE, REPLAY_CANVAS_SIZE, STROKE_COLORS, getGuidesForChar } from "./constants";
import type { HistoryEntry, Point } from "./types";

interface CanvasHooks {
  onStrokeComplete: (points: Point[]) => void;
  getStrokeIndex: () => number;
}

export class WritingCanvas {
  private readonly drawCanvas: HTMLCanvasElement;
  private readonly guideCanvas: HTMLCanvasElement;
  private readonly drawContext: CanvasRenderingContext2D;
  private readonly guideContext: CanvasRenderingContext2D;

  private drawing = false;
  private guideAnimating = false;
  private guideAnimationToken = 0;
  private currentPoints: Point[] = [];

  constructor(drawCanvas: HTMLCanvasElement, guideCanvas: HTMLCanvasElement) {
    this.drawCanvas = drawCanvas;
    this.guideCanvas = guideCanvas;

    const drawContext = this.drawCanvas.getContext("2d");
    const guideContext = this.guideCanvas.getContext("2d");
    if (!drawContext || !guideContext) {
      throw new Error("Canvas context is not available");
    }

    this.drawContext = drawContext;
    this.guideContext = guideContext;

    this.initializeCanvas(drawCanvas);
    this.initializeCanvas(guideCanvas);
  }

  bindInput(hooks: CanvasHooks): void {
    this.drawCanvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.clearGuide();
      const point = this.getPoint(event);
      this.currentPoints = [point];
      this.drawing = true;

      this.drawCanvas.setPointerCapture(event.pointerId);
      this.drawContext.strokeStyle = STROKE_COLORS[hooks.getStrokeIndex() % STROKE_COLORS.length];
      this.drawContext.beginPath();
      this.drawContext.moveTo(point.x, point.y);
    });

    window.addEventListener(
      "pointermove",
      (event) => {
        if (!this.drawing) return;
        event.preventDefault();
        const point = this.getPoint(event);
        this.currentPoints.push(point);
        this.drawContext.lineTo(point.x, point.y);
        this.drawContext.stroke();
      },
      { passive: false },
    );

    const stop = () => {
      if (!this.drawing) return;
      this.drawing = false;

      if (this.currentPoints.length > 0) {
        hooks.onStrokeComplete([...this.currentPoints]);
      }
      this.currentPoints = [];
    };

    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  clearDrawing(): void {
    this.drawContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  clearGuide(): void {
    this.guideContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.guideAnimationToken += 1;
    this.guideAnimating = false;
  }

  isGuideAnimating(): boolean {
    return this.guideAnimating;
  }

  async playGuideAnimation(char: string): Promise<void> {
    const token = this.guideAnimationToken + 1;
    this.guideAnimationToken = token;
    this.guideAnimating = true;
    const guides = getGuidesForChar(char);

    for (let index = 0; index < guides.length; index += 1) {
      if (token !== this.guideAnimationToken) return;

      const guide = guides[index];
      const color = STROKE_COLORS[index % STROKE_COLORS.length];

      this.guideContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      this.guideContext.globalAlpha = 1;
      this.guideContext.fillStyle = color;
      this.guideContext.font = "bold 32px sans-serif";
      this.guideContext.fillText(String(index + 1), guide.n[0], guide.n[1]);
      this.guideContext.beginPath();
      this.guideContext.arc(guide.s[0], guide.s[1], 8, 0, Math.PI * 2);
      this.guideContext.fill();

      this.guideContext.strokeStyle = color;
      this.guideContext.lineWidth = 7;
      this.guideContext.beginPath();
      this.guideContext.moveTo(guide.s[0], guide.s[1]);

      const steps = 20;
      for (let step = 1; step <= steps; step += 1) {
        if (token !== this.guideAnimationToken) return;
        const t = step / steps;
        const x = guide.s[0] + (guide.e[0] - guide.s[0]) * t;
        const y = guide.s[1] + (guide.e[1] - guide.s[1]) * t;
        this.guideContext.lineTo(x, y);
        this.guideContext.stroke();
        await this.wait(24);
      }

      await this.wait(320);
    }

    if (token === this.guideAnimationToken) {
      await this.wait(200);
      this.clearGuide();
    }
  }

  toDataUrl(): string {
    return this.drawCanvas.toDataURL();
  }

  replay(entry: HistoryEntry, replayCanvas: HTMLCanvasElement): void {
    const replayContext = replayCanvas.getContext("2d");
    if (!replayContext) return;

    replayContext.clearRect(0, 0, REPLAY_CANVAS_SIZE, REPLAY_CANVAS_SIZE);
    replayContext.lineCap = "round";
    replayContext.lineJoin = "round";
    replayContext.lineWidth = 12;

    const scale = REPLAY_CANVAS_SIZE / CANVAS_SIZE;
    let strokeIndex = 0;
    let pointIndex = 0;

    const step = (): void => {
      if (strokeIndex >= entry.data.length) return;

      const stroke = entry.data[strokeIndex];
      const point = stroke[pointIndex];
      if (!point) return;

      replayContext.strokeStyle = STROKE_COLORS[strokeIndex % STROKE_COLORS.length];
      if (pointIndex === 0) {
        replayContext.beginPath();
        replayContext.moveTo(point.x * scale, point.y * scale);
      } else {
        replayContext.lineTo(point.x * scale, point.y * scale);
        replayContext.stroke();
      }

      pointIndex += 1;

      if (pointIndex >= stroke.length) {
        strokeIndex += 1;
        pointIndex = 0;
        window.setTimeout(step, 300);
        return;
      }

      const nextPoint = stroke[pointIndex];
      const wait = nextPoint ? Math.max(0, Math.min(nextPoint.t - point.t, 50)) : 16;
      window.setTimeout(step, wait);
    };

    step();
  }

  private initializeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 14;
  }

  private getPoint(event: PointerEvent): Point {
    const rect = this.drawCanvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: Date.now(),
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }
}
