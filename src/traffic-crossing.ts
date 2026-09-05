import { audioService } from "./app/audio";
import "./styles/traffic-crossing.scss";

type TrafficLevel = "one" | "two" | "three" | "four" | "five" | "six";
type LegacyTrafficLevel = "seven" | "eight" | "nine" | "ten";
type StoredScoreKey = TrafficLevel | LegacyTrafficLevel;
type TrafficScreen = "start" | "game" | "result";
type TrafficResult = "success" | "collision";
type SignalState = "red" | "green";
type SpecialVehicle = "ambulance";

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
  special: SpecialVehicle | null;
  hitDistanceX: number;
}

interface SpawnOptions {
  special?: SpecialVehicle;
  speedMultiplier?: number;
  speedOverride?: number;
}

type TrafficScoreStore = Record<TrafficLevel, number[]> & Partial<Record<LegacyTrafficLevel, number[]>>;

interface ScoreResult {
  rank: number | null;
  bestMs: number | null;
}

interface LevelMeta {
  number: number;
  icon: string;
  label: string;
  description: string;
  group: "basic" | "challenge";
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
const IMPACT_DELAY_MS = 560;
const CAR_EMOJIS = ["🚗", "🚕", "🚙"] as const;
const LEVEL_KEYS: TrafficLevel[] = ["one", "two", "three", "four", "five", "six"];
const LEGACY_LEVEL_KEYS: LegacyTrafficLevel[] = ["seven", "eight", "nine", "ten"];

const LEVEL_META: Record<TrafficLevel, LevelMeta> = {
  one: { number: 1, icon: "🐣", label: "LV1・1しゃせん", description: "ひだりから くるまが くるよ", group: "basic" },
  two: { number: 2, icon: "🦁", label: "LV2・2しゃせん", description: "ひだりと みぎ、りょうほうを みよう", group: "basic" },
  three: { number: 3, icon: "🐯", label: "LV3・3しゃせん", description: "3つの しゃせんを じゅんばんに みよう", group: "basic" },
  four: { number: 4, icon: "🐉", label: "LV4・4しゃせん", description: "4つの しゃせんを よくみよう", group: "basic" },
  five: { number: 5, icon: "🚦", label: "LV5・しんごう", description: "あかは まつ。あおでも くるまを みよう", group: "challenge" },
  six: { number: 6, icon: "🚑", label: "LV6・きゅうきゅうしゃ", description: "ちかづく きゅうきゅうしゃにも ちゅうい", group: "challenge" },
};

function isTrafficLevel(value: string | undefined): value is TrafficLevel {
  return typeof value === "string" && LEVEL_KEYS.some((level) => level === value);
}

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
  private resultDelayId: number | null = null;
  private cars: CarState[] = [];
  private nextCarId = 1;
  private spawnCountdowns: number[] = [];
  private openingDecisionPending = true;

  private signalState: SignalState = "green";
  private signalCountdown = 0;
  private ambulanceCountdown = -1;
  private transientMessage = "";
  private transientMessageUntilMs = 0;

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
    const basicButtons = this.levelButtons("basic");
    const challengeButtons = this.levelButtons("challenge");
    const bestTimes = LEVEL_KEYS.map(
      (level) => `<span>🏆 LV${LEVEL_META[level].number} <strong data-role="best-${level}">まだなし</strong></span>`,
    ).join("");

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

          <div class="traffic-crossing-level-group">
            <h4>🚗 しゃせんチャレンジ</h4>
            <div class="traffic-crossing-levels">${basicButtons}</div>
          </div>
          <div class="traffic-crossing-level-group">
            <h4>🧠 ちゅういチャレンジ</h4>
            <div class="traffic-crossing-levels">${challengeButtons}</div>
          </div>

          <div class="traffic-crossing-best-panel" aria-label="ベストタイム">${bestTimes}</div>
          <p class="traffic-crossing-note">⚠️ ぶつかったら、おと・がめんのゆれ・たいおうたんまつの ぶるぶるで おしらせするよ</p>
        </section>

        <section class="traffic-crossing-screen" data-role="game-screen">
          <div class="traffic-crossing-status-row">
            <strong data-role="level-label">LV1・1しゃせん</strong>
            <span class="traffic-crossing-timer" aria-label="けいかじかん">⏱️ <strong data-role="elapsed-time">0.0びょう</strong></span>
            <span class="traffic-crossing-status-message" data-role="game-status">👀 よくみよう</span>
          </div>

          <div class="traffic-crossing-field" data-role="field" aria-label="横断歩道。車を見て、すすむボタンを押している間だけ進みます">
            <div class="traffic-crossing-goal">🏁 ゴール</div>
            <div class="traffic-crossing-signal" data-role="signal-indicator" aria-label="しんごう">
              <span data-role="signal-icon" aria-hidden="true">🟢</span>
              <strong data-role="signal-text">あお</strong>
            </div>
            <div class="traffic-crossing-challenge" data-role="challenge-banner" aria-live="polite"></div>
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

  private levelButtons(group: LevelMeta["group"]): string {
    return LEVEL_KEYS.filter((level) => LEVEL_META[level].group === group)
      .map((level) => {
        const meta = LEVEL_META[level];
        return `
          <button type="button" data-level="${level}">
            <span aria-hidden="true">${meta.icon}</span>
            <strong>${meta.label}</strong>
            <small>${meta.description}</small>
          </button>
        `;
      })
      .join("");
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.root.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
      button.addEventListener("click", () => {
        const level = button.dataset.level;
        if (isTrafficLevel(level)) this.startGame(level);
      });
    });
    this.node<HTMLButtonElement>("retry").addEventListener("click", () => this.startGame(this.level));
    this.node<HTMLButtonElement>("menu").addEventListener("click", () => this.showScreen("start"));

    const hold = this.node<HTMLButtonElement>("hold-button");
    hold.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.requestMove();
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
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        this.requestMove();
      }
    });
    hold.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        this.stopMoving();
      }
    });
  }

  private requestMove(): void {
    if (!this.running || this.screen !== "game") return;
    audioService.resume();
    const blocked = this.movementBlockedMessage();
    if (blocked) {
      this.moving = false;
      this.node<HTMLButtonElement>("hold-button").classList.remove("is-held");
      this.setStatus("⏳ まとう");
      this.setTransientMessage(blocked, 1000);
      audioService.playTone({ frequency: 260, type: "triangle", gain: 0.045, durationMs: 110 });
      return;
    }

    if (this.openingDecisionPending) {
      if (this.elapsedMs < 3500) this.spawnOpeningDecisionCar();
      else this.openingDecisionPending = false;
    }

    this.moving = true;
    this.node<HTMLButtonElement>("hold-button").classList.add("is-held");
    this.setStatus("🚶 すすむ");
  }

  private movementBlockedMessage(): string | null {
    if (this.level === "five" && this.signalState === "red") return "🔴 あか。あおに なるまで まとう";
    return null;
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
    audioService.stopSpeech();
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
    this.openingDecisionPending = true;
    this.resetLevelFeatures();

    const lanes = this.lanes();
    this.spawnCountdowns = lanes.map((lane, index) => this.nextSpawnDelay(lane) + index * 0.28);
    this.node<HTMLElement>("cars").innerHTML = "";
    this.node<HTMLElement>("level-label").textContent = this.levelLabel();
    this.setStatus("👀 よくみよう");
    this.renderTimer(true);
    this.renderRoad(lanes);
    this.renderPlayer();
    this.prepareLevelVisuals();
    this.showScreen("game");

    const decisionLane = this.nextLaneIndex();
    lanes.forEach((lane, index) => {
      if (index === decisionLane) return;
      const initialX = lane.direction === 1 ? this.randomBetween(0.1, 0.25) : this.randomBetween(0.75, 0.9);
      this.spawnCar(index, initialX);
    });

    this.announceLevelRule();
    this.renderFeatureHud();
    this.animationId = window.requestAnimationFrame((time) => this.frame(time));
  }

  private resetLevelFeatures(): void {
    this.signalState = "green";
    this.signalCountdown = 0;
    this.ambulanceCountdown = -1;
    this.transientMessage = "";
    this.transientMessageUntilMs = 0;

    if (this.level === "five") {
      this.signalState = "red";
      this.signalCountdown = this.randomBetween(1.5, 2.4);
    }
    if (this.level === "six") this.ambulanceCountdown = 2.2;
  }

  private announceLevelRule(): void {
    if (this.level === "five") {
      audioService.speak("あかは まつ。あおになっても、くるまを よくみよう。", { rate: 0.92 });
      return;
    }
    if (this.level === "six") {
      audioService.speak("きゅうきゅうしゃが ちかづいてきたら、いったん とまろう。", { rate: 0.92 });
    }
  }

  private prepareLevelVisuals(): void {
    const signal = this.node<HTMLElement>("signal-indicator");
    signal.classList.toggle("is-visible", this.level === "five");
    this.node<HTMLElement>("field").classList.remove("is-impact");
    this.node<HTMLElement>("player").classList.remove("is-hit");
  }

  private lanes(): LaneConfig[] {
    switch (this.level) {
      case "one":
        return [{ y: 0.52, direction: 1, minSpeed: 0.16, maxSpeed: 0.31, minGap: 1.2, maxGap: 3.2 }];
      case "two":
        return [
          { y: 0.42, direction: 1, minSpeed: 0.17, maxSpeed: 0.33, minGap: 1.0, maxGap: 2.8 },
          { y: 0.65, direction: -1, minSpeed: 0.18, maxSpeed: 0.34, minGap: 1.05, maxGap: 2.95 },
        ];
      case "three":
      case "five":
      case "six":
        return [
          { y: 0.34, direction: 1, minSpeed: 0.17, maxSpeed: 0.34, minGap: 0.95, maxGap: 2.65 },
          { y: 0.52, direction: -1, minSpeed: 0.18, maxSpeed: 0.35, minGap: 0.9, maxGap: 2.55 },
          { y: 0.70, direction: 1, minSpeed: 0.19, maxSpeed: 0.36, minGap: 0.95, maxGap: 2.7 },
        ];
      case "four":
        return [
          { y: 0.29, direction: 1, minSpeed: 0.18, maxSpeed: 0.35, minGap: 0.9, maxGap: 2.5 },
          { y: 0.44, direction: -1, minSpeed: 0.19, maxSpeed: 0.36, minGap: 0.85, maxGap: 2.4 },
          { y: 0.59, direction: 1, minSpeed: 0.18, maxSpeed: 0.36, minGap: 0.9, maxGap: 2.45 },
          { y: 0.74, direction: -1, minSpeed: 0.2, maxSpeed: 0.37, minGap: 0.85, maxGap: 2.35 },
        ];
    }
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
    this.updateLevelFeatures(delta);
    this.updatePlayer(delta);
    if (!this.running) return;
    this.updateCars(delta);
    if (!this.running) return;
    this.updateSpawns(delta);
    this.renderFeatureHud();

    this.animationId = window.requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private updateLevelFeatures(delta: number): void {
    if (this.level === "five") this.updateSignal(delta);
    if (this.level === "six") this.updateAmbulanceSpawner(delta);
  }

  private updateSignal(delta: number): void {
    this.signalCountdown -= delta;
    if (this.signalCountdown > 0) return;
    this.signalState = this.signalState === "red" ? "green" : "red";
    this.signalCountdown = this.signalState === "green" ? this.randomBetween(2.6, 4.1) : this.randomBetween(2.0, 3.2);
    if (this.signalState === "red" && this.moving) this.stopMoving();
    audioService.playTone({ frequency: this.signalState === "green" ? 720 : 330, gain: 0.035, durationMs: 100 });
  }

  private updateAmbulanceSpawner(delta: number): void {
    if (this.cars.some((car) => car.special === "ambulance")) return;
    this.ambulanceCountdown -= delta;
    if (this.ambulanceCountdown > 0) return;
    const lanes = this.lanes();
    const laneIndex = Math.floor(Math.random() * lanes.length);
    this.spawnCar(laneIndex, undefined, { special: "ambulance", speedMultiplier: 1.12 });
    this.ambulanceCountdown = this.randomBetween(6.0, 9.0);
    this.playAmbulanceCue();
  }

  private playAmbulanceCue(): void {
    audioService.playTone({ frequency: 760, type: "sine", gain: 0.05, durationMs: 140 });
    audioService.playTone({ frequency: 540, type: "sine", gain: 0.05, durationMs: 140, startDelayMs: 150 });
    audioService.playTone({ frequency: 760, type: "sine", gain: 0.05, durationMs: 140, startDelayMs: 300 });
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
      if (lane && Math.abs(car.x - PLAYER_X) < car.hitDistanceX && Math.abs(lane.y - this.playerY) < CAR_Y_HIT_DISTANCE) {
        this.finish("collision");
        return;
      }
      if (car.x < -0.24 || car.x > 1.24) this.removeCar(car.id);
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
    if (pattern < 0.22) return this.randomBetween(lane.minGap * 0.9, lane.minGap * 1.08);
    if (pattern > 0.84) return this.randomBetween(lane.maxGap * 0.95, lane.maxGap * 1.12);
    return this.randomBetween(lane.minGap, lane.maxGap);
  }

  private nextLaneIndex(): number {
    const lanes = this.lanes();
    let bestIndex = 0;
    let bestY = -Infinity;
    lanes.forEach((lane, index) => {
      if (lane.y < this.playerY && lane.y > bestY) {
        bestY = lane.y;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  private spawnOpeningDecisionCar(): void {
    if (!this.openingDecisionPending) return;
    const lanes = this.lanes();
    const laneIndex = this.nextLaneIndex();
    const lane = lanes[laneIndex];
    if (!lane) return;

    this.openingDecisionPending = false;
    const baseSpeed = (lane.minSpeed + lane.maxSpeed) / 2;
    const speed = baseSpeed * this.randomBetween(0.96, 1.04);
    const timeToLane = Math.max(0.35, (this.playerY - lane.y) / PLAYER_SPEED);
    const collisionTime = timeToLane + this.randomBetween(-0.04, 0.04);
    const initialX = this.clamp(PLAYER_X - lane.direction * speed * collisionTime, -0.12, 1.12);
    this.spawnCar(laneIndex, initialX, { speedOverride: speed });
  }

  private spawnCar(laneIndex: number, initialX?: number, options: SpawnOptions = {}): void {
    const lane = this.lanes()[laneIndex];
    if (!lane) return;
    const element = document.createElement("div");
    element.className = "traffic-crossing-car";
    element.setAttribute("aria-hidden", "true");

    const special = options.special ?? null;
    if (special === "ambulance") {
      element.textContent = "🚑";
      element.classList.add("is-emergency");
    } else {
      element.textContent = CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)] ?? "🚗";
    }
    if (lane.direction === 1) element.classList.add("is-facing-right");
    element.style.top = `${lane.y * 100}%`;

    const speedMultiplier = options.speedMultiplier ?? 1;
    const speed =
      options.speedOverride ?? this.randomBetween(lane.minSpeed, lane.maxSpeed) * speedMultiplier;
    const car: CarState = {
      id: this.nextCarId++,
      laneIndex,
      x: initialX ?? (lane.direction === 1 ? -0.14 : 1.14),
      direction: lane.direction,
      speed,
      element,
      special,
      hitDistanceX: CAR_X_HIT_DISTANCE,
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
    const hold = this.node<HTMLButtonElement>("hold-button");
    hold.classList.remove("is-held");
    if (!this.moving) return;
    this.moving = false;
    if (this.running && this.screen === "game") this.setStatus("✋ ストップ");
  }

  private setStatus(text: string): void {
    this.node<HTMLElement>("game-status").textContent = text;
  }

  private setTransientMessage(text: string, durationMs: number): void {
    this.transientMessage = text;
    this.transientMessageUntilMs = this.elapsedMs + durationMs;
  }

  private renderFeatureHud(): void {
    const signal = this.node<HTMLElement>("signal-indicator");
    if (this.level === "five") {
      this.node<HTMLElement>("signal-icon").textContent = this.signalState === "red" ? "🔴" : "🟢";
      this.node<HTMLElement>("signal-text").textContent = this.signalState === "red" ? "あか" : "あお";
      signal.dataset.state = this.signalState;
    }

    let message = "";
    let danger = false;
    if (this.transientMessage && this.elapsedMs < this.transientMessageUntilMs) {
      message = this.transientMessage;
    } else {
      this.transientMessage = "";
      if (this.level === "five") {
        message = this.signalState === "red" ? "🔴 あか。まとう" : "🟢 あお。くるまも みよう";
      } else if (this.level === "six") {
        const ambulance = this.approachingAmbulance();
        if (ambulance) {
          const distance = Math.abs(ambulance.x - PLAYER_X);
          const arrow = ambulance.direction === 1 ? "→" : "←";
          message = distance < 0.22 ? `🚑 ${arrow} すぐ そこ！ とまろう` : `🚑 ${arrow} ちかづいてる！`;
          danger = true;
        } else {
          message = "👀 くるま と 🚑 を みよう";
        }
      }
    }

    const banner = this.node<HTMLElement>("challenge-banner");
    banner.textContent = message;
    banner.classList.toggle("is-visible", Boolean(message));
    banner.classList.toggle("is-danger", danger);
  }

  private approachingAmbulance(): CarState | null {
    const candidates = this.cars.filter((car) => {
      if (car.special !== "ambulance") return false;
      const approaching = car.direction === 1 ? car.x < PLAYER_X : car.x > PLAYER_X;
      return approaching && Math.abs(car.x - PLAYER_X) < 0.58;
    });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => Math.abs(a.x - PLAYER_X) - Math.abs(b.x - PLAYER_X))[0] ?? null;
  }

  private finish(result: TrafficResult): void {
    if (!this.running) return;
    const completedMs = Math.max(100, Math.round(this.elapsedMs));
    this.running = false;
    this.stopMoving();
    this.node<HTMLElement>("result-time").textContent = `⏱️ ${this.formatTime(completedMs)}`;

    if (result === "collision") {
      this.playCollisionFeedback();
      this.showImpactVisual();
      this.setStatus("💥 ぶつかった！");
      this.node<HTMLElement>("result-icon").textContent = "⚠️";
      this.node<HTMLElement>("result-title").textContent = "ぶつかった！ おしまい";
      this.node<HTMLElement>("result-rank").textContent = "今回は ハイスコアには とうろくしないよ";
      this.node<HTMLElement>("result-message").textContent = "つぎは くるまが とおりすぎてから すすんでみよう。";
      this.renderRanking();
      this.resultDelayId = window.setTimeout(() => {
        this.resultDelayId = null;
        this.showScreen("result");
      }, IMPACT_DELAY_MS);
      return;
    }

    const score = this.registerScore(completedMs);
    audioService.playTone({ frequency: 660, gain: 0.08, durationMs: 180 });
    audioService.playTone({ frequency: 990, gain: 0.08, durationMs: 220, startDelayMs: 150 });
    this.node<HTMLElement>("result-icon").textContent = score.rank === 1 ? "🏆" : "🏁";
    this.node<HTMLElement>("result-title").textContent = score.rank === 1 ? "ベストタイム！" : "わたれた！";
    this.node<HTMLElement>("result-rank").textContent = this.rankMessage(score);
    this.node<HTMLElement>("result-message").textContent = "くるまを みて、すすむ・とまるを じぶんで きめられたね！";
    this.renderRanking();
    this.showScreen("result");
  }

  private playCollisionFeedback(): void {
    audioService.playTone({ frequency: 330, type: "square", gain: 0.14, durationMs: 120, sweepToFrequency: 180 });
    audioService.playTone({ frequency: 170, type: "triangle", gain: 0.16, durationMs: 360, startDelayMs: 90, sweepToFrequency: 70 });

    const vibrationNavigator = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
    if (typeof vibrationNavigator.vibrate !== "function") return;
    try {
      vibrationNavigator.vibrate([320, 90, 360, 90, 440]);
    } catch {
      // Vibration API is optional. Sound and visual impact remain available.
    }
  }

  private showImpactVisual(): void {
    const field = this.node<HTMLElement>("field");
    const player = this.node<HTMLElement>("player");
    field.classList.remove("is-impact");
    player.classList.remove("is-hit");
    void field.offsetWidth;
    field.classList.add("is-impact");
    player.classList.add("is-hit");
  }

  private rankMessage(score: ScoreResult): string {
    if (score.rank === 1) return "🏆 1い！ ベストタイムを こうしん！";
    if (score.rank !== null) return `⭐ ベスト5の ${score.rank}いに はいった！`;
    if (score.bestMs !== null) return `🏆 ベストは ${this.formatTime(score.bestMs)}`;
    return "";
  }

  private emptyScores(): TrafficScoreStore {
    return {
      one: [],
      two: [],
      three: [],
      four: [],
      five: [],
      six: [],
    };
  }

  private loadScores(): TrafficScoreStore {
    const empty = this.emptyScores();
    try {
      const raw = localStorage.getItem(SCORE_STORAGE_KEY);
      if (!raw) return empty;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return empty;
      const candidate = parsed as Partial<Record<StoredScoreKey, unknown>>;
      const scores: TrafficScoreStore = {
        one: this.normalizeScores(candidate.one),
        two: this.normalizeScores(candidate.two),
        three: this.normalizeScores(candidate.three),
        four: this.normalizeScores(candidate.four),
        five: this.normalizeScores(candidate.five),
        six: this.normalizeScores(candidate.six),
      };
      LEGACY_LEVEL_KEYS.forEach((level) => {
        const legacy = this.normalizeScores(candidate[level]);
        if (legacy.length > 0) scores[level] = legacy;
      });
      return scores;
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
    LEVEL_KEYS.forEach((level) => {
      const best = scores[level][0];
      this.node<HTMLElement>(`best-${level}`).textContent = best ? this.formatTime(best) : "まだなし";
    });
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
    audioService.stopSpeech();
    this.node<HTMLButtonElement>("hold-button")?.classList.remove("is-held");
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resultDelayId !== null) {
      window.clearTimeout(this.resultDelayId);
      this.resultDelayId = null;
    }
    this.cars.forEach((car) => car.element.remove());
    this.cars = [];
    this.node<HTMLElement>("field")?.classList.remove("is-impact");
    this.node<HTMLElement>("player")?.classList.remove("is-hit");
  }

  private levelLabel(): string {
    return LEVEL_META[this.level].label;
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
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
