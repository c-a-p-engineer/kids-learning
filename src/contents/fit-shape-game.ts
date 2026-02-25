import { audioService } from "../app/audio";

type FitShapeDifficulty = "easy" | "medium" | "hard";

interface ShapeDefinition {
  id: string;
  path: string;
  color: string;
}

interface DragState {
  pointerId: number;
  block: HTMLElement;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

interface ShapeHistoryRecord {
  id: number;
  date: string;
  difficulty: FitShapeDifficulty;
  difficultyLabel: string;
  score: number;
}

const GAME_TIME_MS = 30_000;
const STORAGE_KEY = "shape_match_history_v1";
const HISTORY_MAX = 50;

const SHAPES: ShapeDefinition[] = [
  { id: "square", path: "M10,10 h80 v80 h-80 z", color: "#ff5f5f" },
  { id: "circle", path: "M50,50 m-40,0 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0", color: "#5fbfff" },
  { id: "triangle", path: "M50,15 L90,85 L10,85 z", color: "#5fff5f" },
  { id: "star", path: "M50,10 L61,38 L90,38 L67,56 L76,85 L50,68 L24,85 L33,56 L10,38 L39,38 z", color: "#ffd700" },
  { id: "pentagon", path: "M50,10 L90,40 L75,90 L25,90 L10,40 z", color: "#ff9f5f" },
  { id: "diamond", path: "M50,10 L90,50 L50,90 L10,50 z", color: "#bf5fff" },
  { id: "hexagon", path: "M50,5 L89,27.5 L89,72.5 L50,95 L11,72.5 L11,27.5 z", color: "#5fffff" },
  { id: "oval", path: "M10,50 C10,25 30,10 50,10 C70,10 90,25 90,50 C90,75 70,90 50,90 C30,90 10,75 10,50 z", color: "#ff5fbf" },
];

const DIFFICULTY_LABEL: Record<FitShapeDifficulty, string> = {
  easy: "かんたん",
  medium: "ふつう",
  hard: "むずかしい",
};

const DIFFICULTY_COUNT: Record<FitShapeDifficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 8,
};

export class FitShapeGame {
  private readonly root: HTMLElement;
  private score = 0;
  private difficulty: FitShapeDifficulty = "easy";
  private timeLeftMs = GAME_TIME_MS;
  private active = false;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private dragState: DragState | null = null;
  private nextRoundTimerId: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    this.bindEvents();
    this.renderHistory();
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.stopGame();
    this.toggleNode("start-menu", true);
    this.toggleNode("result-modal", false);
    this.getNode<HTMLElement>("score").textContent = "0";
    this.updateTimerText(GAME_TIME_MS);
    this.getNode<HTMLElement>("canvas").innerHTML = "";
    this.renderHistory();
  }

  hide(): void {
    this.stopGame();
    this.root.classList.add("hidden");
  }

  private template(): string {
    return `
      <div class="fit-shape-game">
        <div class="fit-shape-panel">
          <div class="fit-shape-head">
            <div class="fit-shape-score">スコア: <span data-role="score">0</span></div>
            <div class="fit-shape-timer" data-role="timer">30.000</div>
          </div>
          <div class="fit-shape-canvas" data-role="canvas"></div>
          <div class="fit-shape-foot">
            <button type="button" class="fit-shape-link-btn" data-role="btn-back-menu">← メニューへ</button>
            <div class="fit-shape-foot-note">シルエットに かさねてね</div>
          </div>
        </div>

        <div class="fit-shape-overlay" data-role="start-menu">
          <div class="fit-shape-start-head">
            <h2 class="fit-shape-title">ぴったりシェイプ</h2>
            <p class="fit-shape-subtitle">おなじ かたちの ところに はめよう！</p>
          </div>
          <div class="fit-shape-level-list">
            <button type="button" class="fit-shape-level-btn fit-shape-level-btn--easy" data-role="btn-start-easy">
              かんたん (3こ)
            </button>
            <button type="button" class="fit-shape-level-btn fit-shape-level-btn--medium" data-role="btn-start-medium">
              ふつう (5こ)
            </button>
            <button type="button" class="fit-shape-level-btn fit-shape-level-btn--hard" data-role="btn-start-hard">
              むずかしい (8こ)
            </button>
          </div>
          <section class="fit-shape-history">
            <h3 class="fit-shape-history-title">📊 さいきんの きろく</h3>
            <div class="fit-shape-history-list" data-role="history-list"></div>
          </section>
        </div>

        <div class="fit-shape-overlay hidden" data-role="result-modal">
          <div class="fit-shape-result-card">
            <h3 class="fit-shape-result-title">タイムアップ！</h3>
            <p class="fit-shape-result-label">今回のスコア</p>
            <div class="fit-shape-result-score" data-role="final-score">0</div>
            <div class="fit-shape-record hidden" data-role="new-record-msg">✨ しんきろく ✨</div>
            <button type="button" class="fit-shape-retry-btn" data-role="btn-retry">もういちど あそぶ</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.getNode<HTMLButtonElement>("btn-start-easy").addEventListener("click", () => this.startGame("easy"));
    this.getNode<HTMLButtonElement>("btn-start-medium").addEventListener("click", () => this.startGame("medium"));
    this.getNode<HTMLButtonElement>("btn-start-hard").addEventListener("click", () => this.startGame("hard"));
    this.getNode<HTMLButtonElement>("btn-retry").addEventListener("click", () => this.backToMenu());
    this.getNode<HTMLButtonElement>("btn-back-menu").addEventListener("click", () => this.backToMenu());
  }

  private getNode<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing fit-shape node: ${role}`);
    }
    return element as T;
  }

  private toggleNode(role: string, show: boolean): void {
    this.getNode<HTMLElement>(role).classList.toggle("hidden", !show);
  }

  private startGame(difficulty: FitShapeDifficulty): void {
    audioService.resume();
    this.stopGame();
    this.difficulty = difficulty;
    this.score = 0;
    this.timeLeftMs = GAME_TIME_MS;
    this.active = true;
    this.lastTimestamp = performance.now();
    this.getNode<HTMLElement>("score").textContent = "0";
    this.updateTimerText(this.timeLeftMs);
    this.toggleNode("start-menu", false);
    this.toggleNode("result-modal", false);
    this.spawnRound();
    this.rafId = window.requestAnimationFrame((ts) => this.tick(ts));
  }

  private stopGame(): void {
    this.active = false;
    this.dragState = null;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.nextRoundTimerId !== null) {
      window.clearTimeout(this.nextRoundTimerId);
      this.nextRoundTimerId = null;
    }
  }

  private tick(timestamp: number): void {
    if (!this.active) return;
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    this.updateTimerText(this.timeLeftMs);

    if (this.timeLeftMs <= 0) {
      this.finishGame();
      return;
    }
    this.rafId = window.requestAnimationFrame((ts) => this.tick(ts));
  }

  private updateTimerText(timeLeftMs: number): void {
    this.getNode<HTMLElement>("timer").textContent = (timeLeftMs / 1000).toFixed(3).padStart(6, "0");
  }

  private spawnRound(): void {
    const canvas = this.getNode<HTMLElement>("canvas");
    canvas.innerHTML = "";
    const count = DIFFICULTY_COUNT[this.difficulty];
    const selected = this.shuffle([...SHAPES]).slice(0, count);
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = Math.max(280, canvasRect.width);
    const canvasHeight = Math.max(320, canvasRect.height);
    const horizontalPadding = 12;
    const zoneRows = count > 4 ? 2 : 1;
    const zoneCols = Math.ceil(count / zoneRows);
    const zoneGapX = 10;
    const zoneGapY = 10;
    const zoneAreaHeight = Math.max(130, Math.min(220, canvasHeight * 0.46));
    const shapeByWidth = (canvasWidth - horizontalPadding * 2 - zoneGapX * (zoneCols - 1)) / zoneCols;
    const shapeByHeight = (zoneAreaHeight - zoneGapY * (zoneRows - 1)) / zoneRows;
    const shapeSize = Math.floor(Math.max(40, Math.min(84, shapeByWidth, shapeByHeight)));
    const totalZoneWidth = zoneCols * shapeSize + (zoneCols - 1) * zoneGapX;
    const zoneStartX = Math.floor((canvasWidth - totalZoneWidth) / 2);
    const zoneStartY = 20;

    selected.forEach((shape, index) => {
      const row = Math.floor(index / zoneCols);
      const col = index % zoneCols;
      const left = zoneStartX + col * (shapeSize + zoneGapX);
      const top = zoneStartY + row * (shapeSize + zoneGapY);
      const zone = document.createElement("div");
      zone.className = "fit-shape-zone";
      zone.dataset.shapeId = shape.id;
      zone.style.setProperty("--fit-zone-color", shape.color);
      zone.style.left = `${left}px`;
      zone.style.top = `${top}px`;
      zone.style.width = `${shapeSize}px`;
      zone.style.height = `${shapeSize}px`;
      zone.innerHTML = `
        <svg viewBox="0 0 100 100" class="fit-shape-zone-svg">
          <path d="${shape.path}" />
        </svg>
      `;
      canvas.appendChild(zone);
    });

    const blockRows = count > 4 ? 2 : 1;
    const blockCols = Math.ceil(count / blockRows);
    const blockGapX = 10;
    const blockGapY = 12;
    const blockAreaStartY = Math.min(canvasHeight - (shapeSize * blockRows + blockGapY * (blockRows - 1) + 20), zoneAreaHeight + 24);
    const totalBlockWidth = blockCols * shapeSize + (blockCols - 1) * blockGapX;
    const blockStartX = Math.floor((canvasWidth - totalBlockWidth) / 2);
    const spawnOrder = this.shuffle(Array.from({ length: count }, (_, i) => i));

    selected.forEach((shape, index) => {
      const order = spawnOrder[index] ?? index;
      const row = Math.floor(order / blockCols);
      const col = order % blockCols;
      const left = blockStartX + col * (shapeSize + blockGapX);
      const top = blockAreaStartY + row * (shapeSize + blockGapY);

      const block = document.createElement("button");
      block.type = "button";
      block.className = "fit-shape-block";
      block.dataset.shapeId = shape.id;
      block.style.left = `${left}px`;
      block.style.top = `${top}px`;
      block.style.width = `${shapeSize}px`;
      block.style.height = `${shapeSize}px`;
      block.innerHTML = `
        <svg viewBox="0 0 100 100" class="fit-shape-block-svg" style="fill: ${shape.color};">
          <path d="${shape.path}" />
        </svg>
      `;
      this.bindDrag(block);
      canvas.appendChild(block);
    });
  }

  private bindDrag(block: HTMLElement): void {
    block.addEventListener("pointerdown", (event) => {
      if (!this.active) return;
      this.dragState = {
        pointerId: event.pointerId,
        block,
        startX: event.clientX,
        startY: event.clientY,
        initialX: block.offsetLeft,
        initialY: block.offsetTop,
      };
      block.classList.add("is-dragging");
      block.setPointerCapture(event.pointerId);
    });

    block.addEventListener("pointermove", (event) => {
      const drag = this.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.block.style.left = `${drag.initialX + dx}px`;
      drag.block.style.top = `${drag.initialY + dy}px`;
    });

    const finishDrag = (event: PointerEvent): void => {
      const drag = this.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.dragState = null;
      drag.block.classList.remove("is-dragging");
      this.checkMatch(drag.block);
    };

    block.addEventListener("pointerup", finishDrag);
    block.addEventListener("pointercancel", finishDrag);
  }

  private checkMatch(block: HTMLElement): void {
    if (!this.active) return;
    const shapeId = block.dataset.shapeId;
    if (!shapeId) return;
    const zones = Array.from(this.root.querySelectorAll<HTMLElement>(".fit-shape-zone"));
    const blockRect = block.getBoundingClientRect();
    const blockCenterX = blockRect.left + blockRect.width / 2;
    const blockCenterY = blockRect.top + blockRect.height / 2;

    const matchedZone = zones.find((zone) => {
      if (zone.dataset.shapeId !== shapeId || zone.classList.contains("is-matched")) return false;
      const zoneRect = zone.getBoundingClientRect();
      const zoneCenterX = zoneRect.left + zoneRect.width / 2;
      const zoneCenterY = zoneRect.top + zoneRect.height / 2;
      const distance = Math.hypot(blockCenterX - zoneCenterX, blockCenterY - zoneCenterY);
      return distance < Math.max(22, zoneRect.width * 0.45);
    });

    if (!matchedZone) return;

    block.style.left = matchedZone.style.left;
    block.style.top = matchedZone.style.top;
    block.style.pointerEvents = "none";
    block.classList.add("is-success");
    matchedZone.classList.add("is-matched");
    this.score += 1;
    this.getNode<HTMLElement>("score").textContent = String(this.score);
    this.playMatchSound();

    window.setTimeout(() => {
      block.remove();
    }, 360);

    this.checkRoundClear();
  }

  private checkRoundClear(): void {
    const remaining = this.root.querySelectorAll(".fit-shape-block:not(.is-success)");
    if (remaining.length > 0) return;
    this.playClearSound();
    this.createConfetti();
    if (!this.active) return;
    this.nextRoundTimerId = window.setTimeout(() => {
      if (!this.active) return;
      this.spawnRound();
    }, 620);
  }

  private createConfetti(): void {
    const canvas = this.getNode<HTMLElement>("canvas");
    for (let i = 0; i < 24; i += 1) {
      const confetti = document.createElement("div");
      confetti.className = "fit-shape-confetti";
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 56%)`;
      canvas.appendChild(confetti);
      const animation = confetti.animate(
        [
          { transform: "translateY(0) rotate(0deg)", opacity: 1 },
          {
            transform: `translateY(${200 + Math.random() * 140}px) translateX(${(Math.random() - 0.5) * 120}px) rotate(${360 + Math.random() * 360}deg)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 700, easing: "ease-out" },
      );
      animation.onfinish = () => confetti.remove();
    }
  }

  private finishGame(): void {
    this.stopGame();
    this.playEndSound();
    const isRecord = this.saveHistory();
    this.getNode<HTMLElement>("final-score").textContent = String(this.score);
    this.toggleNode("result-modal", true);
    this.getNode<HTMLElement>("new-record-msg").classList.toggle("hidden", !isRecord);
  }

  private backToMenu(): void {
    this.stopGame();
    this.getNode<HTMLElement>("canvas").innerHTML = "";
    this.getNode<HTMLElement>("score").textContent = "0";
    this.updateTimerText(GAME_TIME_MS);
    this.toggleNode("result-modal", false);
    this.toggleNode("start-menu", true);
    this.renderHistory();
  }

  private loadHistory(): ShapeHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is ShapeHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<ShapeHistoryRecord>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          (row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard") &&
          typeof row.difficultyLabel === "string" &&
          typeof row.score === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private saveHistory(): boolean {
    const history = this.loadHistory();
    const now = new Date();
    const date = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    const sameDifficultyScores = history
      .filter((row) => row.difficulty === this.difficulty)
      .map((row) => row.score);
    const best = sameDifficultyScores.length > 0 ? Math.max(...sameDifficultyScores) : 0;
    const isRecord = this.score > best;

    history.unshift({
      id: Date.now(),
      date,
      difficulty: this.difficulty,
      difficultyLabel: DIFFICULTY_LABEL[this.difficulty],
      score: this.score,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
    return isRecord;
  }

  private renderHistory(): void {
    const history = this.loadHistory();
    const container = this.getNode<HTMLElement>("history-list");
    if (history.length === 0) {
      container.innerHTML = '<div class="fit-shape-history-empty">まだ きろくが ありません</div>';
      return;
    }

    container.innerHTML = history.slice(0, 5).map((row) => `
      <div class="fit-shape-history-item">
        <span>${row.date} (${row.difficultyLabel})</span>
        <strong>${row.score}点</strong>
      </div>
    `).join("");
  }

  private playMatchSound(): void {
    audioService.playTone({ frequency: 523.25, type: "sine", gain: 0.1, durationMs: 180 });
    audioService.playTone({ frequency: 659.25, type: "sine", gain: 0.1, durationMs: 180, startDelayMs: 60 });
  }

  private playClearSound(): void {
    [523, 659, 783, 1046].forEach((frequency, index) => {
      audioService.playTone({
        frequency,
        type: "square",
        gain: 0.09,
        durationMs: 220,
        startDelayMs: index * 95,
      });
    });
  }

  private playEndSound(): void {
    [440, 349, 261].forEach((frequency, index) => {
      audioService.playTone({
        frequency,
        type: "triangle",
        gain: 0.09,
        durationMs: 280,
        startDelayMs: index * 140,
      });
    });
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
