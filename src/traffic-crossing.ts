import { audioService } from "./app/audio";
import "./styles/traffic-crossing.scss";

type TrafficLevel = "one" | "two";
type TrafficScreen = "start" | "game" | "result";
type TrafficResult = "success" | "collision";

interface LaneConfig {
  y: number;
  direction: 1 | -1;
  minSpeed: number;
  maxSpeed: number;
  minGap: number;
  maxGap: number;
}

interface CarState {
  id: number;
  laneIndex: number;
  x: number;
  direction: 1 | -1;
  speed: number;
  element: HTMLElement;
}

interface TrafficScoreStore {
  one: number[];
  two: number[];
}

interface ScoreResult {
  rank: number | null;
  bestMs: number | null;
}

const CONTENT_ID = "traffic-crossing";
const SCORE_STORAGE_KEY = "traffic_crossing_v1_scores";
const MAX_SCORES_PER_LEVEL = 5;
const PLAYER_START_Y = 0.91;
const PLAYER_GOAL_Y = 0.08;
const PLAYER_SPEED = 0.19;
const PLAYER_X = 0.5;
const CAR_X_HIT_DISTANCE = 0.11;
const CAR_Y_HIT_DISTANCE = 0.065;
const CAR_EMOJIS = ["🚗", "🚕", "🚙"] as const;

class TrafficCrossingGame {
  private readonly root: HTMLElement;
  private readonly portalPath: string;
  private screen: TrafficScreen = "start";
  private level: TrafficLevel = "one";
  private playerY = PLAYER_START_Y;
  private moving = false;
  private running = false;
  private lastFrameTime = 0;
  private elapsedMs = 0;
  private lastTimerTenth = -1;
  private animationId: number | null = null;
  private cars: CarState[] = [];
  private nextCarId = 1;
  private spawnCountdowns: number[] = [];

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "traffic-crossing-experience";
    this.root.className = "traffic-crossing-experience hidden";
    this.root.setAttribute("aria-label", "しんごうをわたれ");
    this.root.innerHTML = this.template();
    main.appendChild(this.root);
    this.bindEvents();
  }

  init(): void {
    this.decoratePortalCard();
    this.bindPortalCard();
    window.addEventListener("popstate", () => window.requestAnimationFrame(() => this.syncFromLocation()));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopMoving();
    });
    this.syncFromLocation();
  }

  private template(): string {
    return `
      <div class="traffic-crossing-shell">
        <header class="traffic-crossing-header">
          <div>
            <p class="traffic-crossing-step">STEP 2</p>
            <h2>🚦 しんごうを わたれ！</h2>
          </div>
          <button type="button" class="traffic-crossing-back" data-role="back-portal">🏠 いちらん</button>
        </header>

        <section class="traffic-crossing-screen is-active" data-role="start-screen">
          <div class="traffic-crossing-hero" aria-hidden="true">🚗　🚸　🚙</div>
          <h3>くるまを みて、あんぜんに わたろう</h3>
          <p>「すすむ」を おしている あいだだけ あるくよ。あぶないと おもったら ゆびを はなして ストップ！</p>
          <div class="traffic-crossing-levels">
            <button type="button" data-role="start-one">
              <span aria-hidden="true">🐣</span>
              <strong>LV1・1しゃせん</strong>
              <small>ひだりから くるまが くるよ</small>
            </button>
            <button type="button" data-role="start-two">
              <span aria-hidden="true">🦁</span>
              <strong>LV2・2しゃせん</strong>
              <small>ひだりと みぎ、りょうほうを みよう</small>
            </button>
          </div>
          <div class="traffic-crossing-best-panel" aria-label="ベストタイム">
            <span>🏆 LV1 <strong data-role="best-one">まだなし</strong></span>
            <span>🏆 LV2 <strong data-role="best-two">まだなし</strong></span>
          </div>
          <p class="traffic-crossing-note">⚠️ くるまと ぶつかったら そのかいは おしまい</p>
        </section>

        <section class="traffic-crossing-screen" data-role="game-screen">
          <div class="traffic-crossing-status-row">
            <strong data-role="level-label">LV1・1しゃせん</strong>
            <span data-role="game-status">👀 くるまを よくみよう</span>
            <span class="traffic-crossing-timer" aria-label="けいかじかん">⏱️ <strong data-role="elapsed-time">0.0びょう</strong></span>
          </div>

          <div class="traffic-crossing-field" data-role="field" aria-label="横断歩道。車を見て、すすむボタンを押している間だけ進みます">
            <div class="traffic-crossing-goal">🏁 ゴール</div>
            <div class="traffic-crossing-road" data-role="road"></div>
            <div class="traffic-crossing-cars" data-role="cars"></div>
            <div class="traffic-crossing-player" data-role="player" aria-hidden="true">🧒</div>
          </div>

          <button type="button" class="traffic-crossing-hold" data-role="hold-button" aria-label="押している間すすむ">
            <span aria-hidden="true">👆</span>
            <strong>おして すすむ</strong>
            <small>はなすと ストップ</small>
          </button>
        </section>

        <section class="traffic-crossing-screen" data-role="result-screen">
          <div class="traffic-crossing-result-icon" data-role="result-icon" aria-hidden="true">🏁</div>
          <h3 data-role="result-title">わたれた！</h3>
          <p class="traffic-crossing-result-time" data-role="result-time">⏱️ 0.0びょう</p>
          <p class="traffic-crossing-result-rank" data-role="result-rank"></p>
          <p data-role="result-message">くるまを みて、じぶんで とまれたね！</p>
          <div class="traffic-crossing-ranking" data-role="ranking" aria-label="ベストタイムランキング"></div>
          <div class="traffic-crossing-result-actions">
            <button type="button" class="traffic-crossing-primary" data-role="retry">🔁 もういちど</button>
            <button type="button" data-role="menu">🎮 レベルを えらぶ</button>
          </div>
        </section>
      </div>
    `;
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.node<HTMLButtonElement>("start-one").addEventListener("click", () => this.startGame("one"));
    this.node<HTMLButtonElement>("start-two").addEventListener("click", () => this.startGame("two"));
    this.node<HTMLButtonElement>("retry").addEventListener("click", () => this.startGame(this.level));
    this.node<HTMLButtonElement>("menu").addEventListener("click", () => this.showScreen("start"));

    const hold = this.node<HTMLButtonElement>("hold-button");
    hold.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!this.running) return;
      this.moving = true;
      hold.classList.add("is-held");
      this.node<HTMLElement>("game-status").textContent = "🚶 すすんでるよ";
    });
    hold.addEventListener("pointermove", (event) => {
      if (!this.moving) return;
      const rect = hold.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) this.stopMoving();
    });
    hold.addEventListener("pointerleave", () => this.stopMoving());
    hold.addEventListener("pointercancel", () => this.stopMoving());
    window.addEventListener("pointerup", () => this.stopMoving());

    hold.addEventListener("keydown", (event) => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat && this.running) {
        event.preventDefault();
        this.moving = true;
        hold.classList.add("is-held");
        this.node<HTMLElement>("game-status").textContent = "🚶 すすんでるよ";
      }
    });
    hold.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        this.stopMoving();
      }
    });
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.trafficCrossingBound === "true") return;
    list.dataset.trafficCrossingBound = "true";
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

  private decoratePortalCard(): void {
    const card = document.querySelector<HTMLElement>(`[data-content-id="${CONTENT_ID}"]`);
    if (!card) {
      window.requestAnimationFrame(() => this.decoratePortalCard());
      return;
    }
    card.dataset.category = "memory";
    const icon = card.querySelector<HTMLElement>(".content-icon");
    if (icon) icon.textContent = "🚦";
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.stopGameLoop();
    window.history.pushState(null, "", this.portalPath);
    this.hideExperience();
    document.getElementById("view-portal")?.classList.remove("hidden");
  }

  private syncFromLocation(): void {
    if (this.isCurrentPath()) this.showExperience();
    else this.hideExperience();
  }

  private showExperience(): void {
    document.querySelectorAll<HTMLElement>("#main-content > .view").forEach((view) => view.classList.add("hidden"));
    this.root.classList.remove("hidden");
    this.showScreen("start");
  }

  private hideExperience(): void {
    this.stopGameLoop();
    this.root.classList.add("hidden");
  }

  private showScreen(screen: TrafficScreen): void {
    this.screen = screen;
    this.node<HTMLElement>("start-screen").classList.toggle("is-active", screen === "start");
    this.node<HTMLElement>("game-screen").classList.toggle("is-active", screen === "game");
    this.node<HTMLElement>("result-screen").classList.toggle("is-active", screen === "result");
    if (screen === "start") this.renderBestTimes();
    if (screen !== "game") this.stopGameLoop();
  }

  private startGame(level: TrafficLevel): void {
    audioService.resume();
    this.stopGameLoop();
    this.level = level;
    this.playerY = PLAYER_START_Y;
    this.moving = false;
    this.running = true;
    this.lastFrameTime = 0;
    this.elapsedMs = 0;
    this.lastTimerTenth = -1;
    this.cars = [];
    this.nextCarId = 1;
    const lanes = this.lanes();
    this.spawnCountdowns = lanes.map((lane, index) => this.nextSpawnDelay(lane) + index * 0.35);
    this.node<HTMLElement>("cars").innerHTML = "";
    this.node<HTMLElement>("level-label").textContent = this.levelLabel();
    this.node<HTMLElement>("game-status").textContent = "👀 くるまを よくみよう";
    this.renderTimer(true);
    this.renderRoad(lanes);
    this.renderPlayer();
    this.showScreen("game");

    lanes.forEach((lane, index) => {
      const initialX = lane.direction === 1 ? this.randomBetween(0.12, 0.28) : this.randomBetween(0.72, 0.88);
      this.spawnCar(index, initialX);
    });

    this.animationId = window.requestAnimationFrame((time) => this.frame(time));
  }

  private lanes(): LaneConfig[] {
    if (this.level === "one") {
      return [{ y: 0.52, direction: 1, minSpeed: 0.16, maxSpeed: 0.31, minGap: 1.35, maxGap: 3.6 }];
    }
    return [
      { y: 0.42, direction: 1, minSpeed: 0.17, maxSpeed: 0.33, minGap: 1.1, maxGap: 3.0 },
      { y: 0.65, direction: -1, minSpeed: 0.18, maxSpeed: 0.34, minGap: 1.15, maxGap: 3.15 },
    ];
  }

  private renderRoad(lanes: LaneConfig[]): void {
    const road = this.node<HTMLElement>("road");
    road.innerHTML = lanes
      .map(
        (lane, index) => `
          <div class="traffic-crossing-lane" style="top:${lane.y * 100}%" aria-hidden="true">
            <span>${index + 1}</span>
          </div>
        `,
      )
      .join("");
  }

  private frame(time: number): void {
    if (!this.running || this.screen !== "game") return;
    if (this.lastFrameTime === 0) this.lastFrameTime = time;
    const delta = Math.min(0.05, Math.max(0, (time - this.lastFrameTime) / 1000));
    this.lastFrameTime = time;

    this.elapsedMs += delta * 1000;
    this.renderTimer();
    this.updatePlayer(delta);
    this.updateCars(delta);
    if (!this.running) return;
    this.updateSpawns(delta);

    this.animationId = window.requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private updatePlayer(delta: number): void {
    if (!this.moving) return;
    this.playerY = Math.max(PLAYER_GOAL_Y, this.playerY - PLAYER_SPEED * delta);
    this.renderPlayer();
    if (this.playerY <= PLAYER_GOAL_Y) this.finish("success");
  }

  private renderPlayer(): void {
    const player = this.node<HTMLElement>("player");
    player.style.left = `${PLAYER_X * 100}%`;
    player.style.top = `${this.playerY * 100}%`;
  }

  private renderTimer(force = false): void {
    const tenth = Math.floor(this.elapsedMs / 100);
    if (!force && tenth === this.lastTimerTenth) return;
    this.lastTimerTenth = tenth;
    this.node<HTMLElement>("elapsed-time").textContent = `${(this.elapsedMs / 1000).toFixed(1)}びょう`;
  }

  private updateCars(delta: number): void {
    const lanes = this.lanes();
    for (const car of [...this.cars]) {
      car.x += car.direction * car.speed * delta;
      car.element.style.left = `${car.x * 100}%`;
      const lane = lanes[car.laneIndex];
      if (lane && Math.abs(car.x - PLAYER_X) < CAR_X_HIT_DISTANCE && Math.abs(lane.y - this.playerY) < CAR_Y_HIT_DISTANCE) {
        this.finish("collision");
        return;
      }
      if (car.x < -0.2 || car.x > 1.2) this.removeCar(car.id);
    }
  }

  private updateSpawns(delta: number): void {
    const lanes = this.lanes();
    this.spawnCountdowns = this.spawnCountdowns.map((remaining, index) => {
      const next = remaining - delta;
      if (next > 0) return next;
      this.spawnCar(index);
      const lane = lanes[index];
      return lane ? this.nextSpawnDelay(lane) : 2;
    });
  }

  private nextSpawnDelay(lane: LaneConfig): number {
    const pattern = Math.random();
    if (pattern < 0.18) {
      return this.randomBetween(lane.minGap * 0.9, lane.minGap * 1.1);
    }
    if (pattern > 0.82) {
      return this.randomBetween(lane.maxGap * 0.95, lane.maxGap * 1.2);
    }
    return this.randomBetween(lane.minGap, lane.maxGap);
  }

  private spawnCar(laneIndex: number, initialX?: number): void {
    const lane = this.lanes()[laneIndex];
    if (!lane) return;
    const element = document.createElement("div");
    element.className = "traffic-crossing-car";
    element.setAttribute("aria-hidden", "true");
    element.textContent = CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)] ?? "🚗";
    if (lane.direction === 1) element.classList.add("is-facing-right");
    element.style.top = `${lane.y * 100}%`;

    const car: CarState = {
      id: this.nextCarId++,
      laneIndex,
      x: initialX ?? (lane.direction === 1 ? -0.14 : 1.14),
      direction: lane.direction,
      speed: this.randomBetween(lane.minSpeed, lane.maxSpeed),
      element,
    };
    element.style.left = `${car.x * 100}%`;
    this.node<HTMLElement>("cars").appendChild(element);
    this.cars.push(car);
  }

  private removeCar(id: number): void {
    const index = this.cars.findIndex((car) => car.id === id);
    if (index < 0) return;
    this.cars[index].element.remove();
    this.cars.splice(index, 1);
  }

  private stopMoving(): void {
    if (!this.moving) return;
    this.moving = false;
    this.node<HTMLButtonElement>("hold-button").classList.remove("is-held");
    if (this.running && this.screen === "game") this.node<HTMLElement>("game-status").textContent = "✋ とまったよ。くるまを みよう";
  }

  private finish(result: TrafficResult): void {
    if (!this.running) return;
    const completedMs = Math.max(100, Math.round(this.elapsedMs));
    this.running = false;
    this.stopMoving();
    this.node<HTMLElement>("result-time").textContent = `⏱️ ${this.formatTime(completedMs)}`;

    if (result === "collision") {
      audioService.playTone({ frequency: 240, type: "triangle", gain: 0.07, durationMs: 240, sweepToFrequency: 150 });
      this.node<HTMLElement>("result-icon").textContent = "⚠️";
      this.node<HTMLElement>("result-title").textContent = "ぶつかった！ おしまい";
      this.node<HTMLElement>("result-rank").textContent = "今回は ハイスコアには とうろくしないよ";
      this.node<HTMLElement>("result-message").textContent = "つぎは くるまが とおりすぎてから すすんでみよう。";
      this.renderRanking();
    } else {
      const score = this.registerScore(completedMs);
      audioService.playTone({ frequency: 660, gain: 0.08, durationMs: 180 });
      audioService.playTone({ frequency: 990, gain: 0.08, durationMs: 220, startDelayMs: 150 });
      this.node<HTMLElement>("result-icon").textContent = score.rank === 1 ? "🏆" : "🏁";
      this.node<HTMLElement>("result-title").textContent = score.rank === 1 ? "ベストタイム！" : "わたれた！";
      this.node<HTMLElement>("result-rank").textContent = this.rankMessage(score);
      this.node<HTMLElement>("result-message").textContent = "くるまを みて、すすむ・とまるを じぶんで きめられたね！";
      this.renderRanking();
    }
    this.showScreen("result");
  }

  private rankMessage(score: ScoreResult): string {
    if (score.rank === 1) return "🏆 1い！ ベストタイムを こうしん！";
    if (score.rank !== null) return `⭐ ベスト5の ${score.rank}いに はいった！`;
    if (score.bestMs !== null) return `🏆 ベストは ${this.formatTime(score.bestMs)}`;
    return "";
  }

  private loadScores(): TrafficScoreStore {
    const empty: TrafficScoreStore = { one: [], two: [] };
    try {
      const raw = localStorage.getItem(SCORE_STORAGE_KEY);
      if (!raw) return empty;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return empty;
      const candidate = parsed as Partial<Record<TrafficLevel, unknown>>;
      return {
        one: this.normalizeScores(candidate.one),
        two: this.normalizeScores(candidate.two),
      };
    } catch {
      return empty;
    }
  }

  private normalizeScores(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is number => typeof item === "number" && Number.isFinite(item) && item > 0 && item < 600_000)
      .sort((a, b) => a - b)
      .slice(0, MAX_SCORES_PER_LEVEL);
  }

  private registerScore(timeMs: number): ScoreResult {
    const scores = this.loadScores();
    const ranked = [...scores[this.level], timeMs].sort((a, b) => a - b);
    const rawRank = ranked.indexOf(timeMs) + 1;
    scores[this.level] = ranked.slice(0, MAX_SCORES_PER_LEVEL);
    try {
      localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scores));
    } catch {
      return { rank: null, bestMs: scores[this.level][0] ?? null };
    }
    return {
      rank: rawRank <= MAX_SCORES_PER_LEVEL ? rawRank : null,
      bestMs: scores[this.level][0] ?? null,
    };
  }

  private renderBestTimes(): void {
    const scores = this.loadScores();
    this.node<HTMLElement>("best-one").textContent = scores.one[0] ? this.formatTime(scores.one[0]) : "まだなし";
    this.node<HTMLElement>("best-two").textContent = scores.two[0] ? this.formatTime(scores.two[0]) : "まだなし";
  }

  private renderRanking(): void {
    const scores = this.loadScores()[this.level];
    const ranking = this.node<HTMLElement>("ranking");
    if (scores.length === 0) {
      ranking.innerHTML = '<strong>🏆 ベスト5</strong><p>まだ きろくが ないよ</p>';
      return;
    }
    ranking.innerHTML = `
      <strong>🏆 ${this.levelLabel()} ベスト5</strong>
      <ol>${scores.map((time) => `<li>${this.formatTime(time)}</li>`).join("")}</ol>
    `;
  }

  private formatTime(timeMs: number): string {
    return `${(timeMs / 1000).toFixed(1)}びょう`;
  }

  private stopGameLoop(): void {
    this.running = false;
    this.moving = false;
    this.node<HTMLButtonElement>("hold-button")?.classList.remove("is-held");
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.cars.forEach((car) => car.element.remove());
    this.cars = [];
  }

  private levelLabel(): string {
    return this.level === "one" ? "LV1・1しゃせん" : "LV2・2しゃせん";
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing traffic-crossing node: ${role}`);
    return element as T;
  }

  private resolvePortalPath(): string {
    const normalized = window.location.pathname.replace(/\/$/, "");
    if (normalized.endsWith(`/${CONTENT_ID}`)) {
      const base = normalized.slice(0, -CONTENT_ID.length);
      return base.endsWith("/") ? base : `${base}/`;
    }
    return window.location.pathname.endsWith("/") ? window.location.pathname : `${window.location.pathname}/`;
  }

  private isCurrentPath(): boolean {
    return window.location.pathname.replace(/\/$/, "").endsWith(`/${CONTENT_ID}`);
  }
}

function initTrafficCrossing(): void {
  const game = new TrafficCrossingGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTrafficCrossing, { once: true });
} else {
  initTrafficCrossing();
}
