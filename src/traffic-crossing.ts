import { audioService } from "./app/audio";
import "./styles/traffic-crossing.scss";

type TrafficLevel = "one" | "two";
type TrafficScreen = "start" | "game" | "result";
type TrafficResult = "success" | "collision";

interface LaneConfig {
  y: number;
  direction: 1 | -1;
  speed: number;
}

interface CarState {
  id: number;
  laneIndex: number;
  x: number;
  direction: 1 | -1;
  speed: number;
  element: HTMLElement;
}

const CONTENT_ID = "traffic-crossing";
const PLAYER_START_Y = 0.91;
const PLAYER_GOAL_Y = 0.08;
const PLAYER_SPEED = 0.19;
const PLAYER_X = 0.5;
const CAR_X_HIT_DISTANCE = 0.11;
const CAR_Y_HIT_DISTANCE = 0.065;

class TrafficCrossingGame {
  private readonly root: HTMLElement;
  private readonly portalPath: string;
  private screen: TrafficScreen = "start";
  private level: TrafficLevel = "one";
  private playerY = PLAYER_START_Y;
  private moving = false;
  private running = false;
  private lastFrameTime = 0;
  private animationId: number | null = null;
  private cars: CarState[] = [];
  private nextCarId = 1;
  private spawnCountdowns: number[] = [];
  private result: TrafficResult = "success";

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
          <p class="traffic-crossing-note">⚠️ くるまと ぶつかったら そのかいは おしまい</p>
        </section>

        <section class="traffic-crossing-screen" data-role="game-screen">
          <div class="traffic-crossing-status-row">
            <strong data-role="level-label">LV1・1しゃせん</strong>
            <span data-role="game-status">👀 くるまを よくみよう</span>
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
          <p data-role="result-message">くるまを みて、じぶんで とまれたね！</p>
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
    this.cars = [];
    this.nextCarId = 1;
    const lanes = this.lanes();
    this.spawnCountdowns = lanes.map((_, index) => 0.7 + index * 0.45);
    this.node<HTMLElement>("cars").innerHTML = "";
    this.node<HTMLElement>("level-label").textContent = this.levelLabel();
    this.node<HTMLElement>("game-status").textContent = "👀 くるまを よくみよう";
    this.renderRoad(lanes);
    this.renderPlayer();
    this.showScreen("game");

    lanes.forEach((lane, index) => {
      const initialX = lane.direction === 1 ? 0.18 + index * 0.08 : 0.82 - index * 0.08;
      this.spawnCar(index, initialX);
    });

    this.animationId = window.requestAnimationFrame((time) => this.frame(time));
  }

  private lanes(): LaneConfig[] {
    if (this.level === "one") return [{ y: 0.52, direction: 1, speed: 0.23 }];
    return [
      { y: 0.42, direction: 1, speed: 0.22 },
      { y: 0.65, direction: -1, speed: 0.25 },
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
      const base = this.level === "one" ? 2.15 : 1.8;
      return base + Math.random() * 1.15 + (lanes[index]?.speed ?? 0.2) * 0.5;
    });
  }

  private spawnCar(laneIndex: number, initialX?: number): void {
    const lane = this.lanes()[laneIndex];
    if (!lane) return;
    const element = document.createElement("div");
    element.className = "traffic-crossing-car";
    element.setAttribute("aria-hidden", "true");
    element.textContent = laneIndex % 2 === 0 ? "🚗" : "🚙";
    if (lane.direction === -1) element.classList.add("is-reverse");
    element.style.top = `${lane.y * 100}%`;

    const car: CarState = {
      id: this.nextCarId++,
      laneIndex,
      x: initialX ?? (lane.direction === 1 ? -0.14 : 1.14),
      direction: lane.direction,
      speed: lane.speed * (0.9 + Math.random() * 0.2),
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
    this.result = result;
    this.running = false;
    this.stopMoving();
    if (result === "collision") {
      audioService.playTone({ frequency: 240, type: "triangle", gain: 0.07, durationMs: 240, sweepToFrequency: 150 });
      this.node<HTMLElement>("result-icon").textContent = "⚠️";
      this.node<HTMLElement>("result-title").textContent = "ぶつかった！ おしまい";
      this.node<HTMLElement>("result-message").textContent = "つぎは くるまが とおりすぎてから すすんでみよう。";
    } else {
      audioService.playTone({ frequency: 660, gain: 0.08, durationMs: 180 });
      audioService.playTone({ frequency: 990, gain: 0.08, durationMs: 220, startDelayMs: 150 });
      this.node<HTMLElement>("result-icon").textContent = "🏁";
      this.node<HTMLElement>("result-title").textContent = "わたれた！";
      this.node<HTMLElement>("result-message").textContent = "くるまを みて、すすむ・とまるを じぶんで きめられたね！";
    }
    this.showScreen("result");
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
