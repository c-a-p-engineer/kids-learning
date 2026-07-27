import { audioService } from "./app/audio";
import "./styles/clock-reading.scss";

type ClockLevel = "easy" | "normal" | "hard";
type ClockScreen = "start" | "game" | "history" | "result";

interface ClockChoice {
  key: number;
  hour: number;
  minute: number;
}

interface ClockQuestion {
  hour: number;
  minute: number;
  answerKey: number;
  choices: ClockChoice[];
}

interface ClockHistoryRecord {
  id: number;
  date: string;
  level: ClockLevel;
  levelLabel: string;
  score: number;
  correct: number;
  total: number;
}

interface ClockState {
  level: ClockLevel;
  screen: ClockScreen;
  score: number;
  correct: number;
  total: number;
  combo: number;
  timeLeftMs: number;
  lastTimestamp: number;
  locked: boolean;
  question: ClockQuestion | null;
}

const CONTENT_ID = "clock-reading";
const STORAGE_KEY = "clock_reading_v1_history";
const GAME_TIME_MS = 30_000;
const MAX_HISTORY = 50;
const LEARNING_PATH = [
  { id: "fit-shape", icon: "🧩", phase: "みる" },
  { id: "flashcard", icon: "🧠", phase: "おぼえる" },
  { id: "dotburst", icon: "🟡", phase: "かず" },
  { id: "number-sequence", icon: "🔢", phase: "ならび" },
  { id: "larger-number", icon: "⚖️", phase: "くらべる" },
  { id: CONTENT_ID, icon: "🕐", phase: "とけい" },
  { id: "kakitori", icon: "✏️", phase: "かく" },
] as const;

class ClockReadingGame {
  private readonly root: HTMLElement;
  private readonly portalPath: string;
  private readonly state: ClockState = {
    level: "easy",
    screen: "start",
    score: 0,
    correct: 0,
    total: 0,
    combo: 0,
    timeLeftMs: GAME_TIME_MS,
    lastTimestamp: 0,
    locked: false,
    question: null,
  };
  private rafId: number | null = null;
  private nextTimerId: number | null = null;

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "clock-reading-experience";
    this.root.className = "clock-reading-experience hidden";
    this.root.setAttribute("aria-label", "時計を読むゲーム");
    this.root.innerHTML = this.template();
    main.appendChild(this.root);
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
      <div class="clock-reading-shell">
        <header class="clock-reading-header">
          <div>
            <p class="clock-reading-step">STEP 6</p>
            <h2>🕐 とけいを よもう</h2>
          </div>
          <button type="button" class="clock-reading-back" data-role="back-portal" aria-label="学びの一覧にもどる">
            🏠 いちらん
          </button>
        </header>

        <section class="clock-reading-screen is-active" data-role="start-screen">
          <div class="clock-reading-hero" aria-hidden="true">🕘</div>
          <h3>とけいと おなじ じこくを えらぼう</h3>
          <p class="clock-reading-limit">⏱️ どのレベルも 30びょうで おしまい</p>
          <div class="clock-reading-levels">
            <button type="button" data-role="start-easy">🐣 やさしい<br><small>ちょうどの じこく</small></button>
            <button type="button" data-role="start-normal">🦁 ふつう<br><small>ちょうど・30ぷん</small></button>
            <button type="button" data-role="start-hard">🚀 むずかしい<br><small>5ふんごと</small></button>
          </div>
          <button type="button" class="clock-reading-sub" data-role="open-history">📊 きろくを みる</button>
        </section>

        <section class="clock-reading-screen" data-role="game-screen">
          <div class="clock-reading-status">
            <span>⭐ <strong data-role="score">0</strong>てん</span>
            <span>⭕ <strong data-role="correct">0</strong>もん</span>
            <span>⏱️ <strong data-role="timer">30.0</strong></span>
          </div>
          <div class="clock-reading-timer-track" aria-label="のこり時間">
            <div class="clock-reading-timer-fill" data-role="timer-fill"></div>
          </div>
          <p class="clock-reading-instruction">この とけいは なんじ？</p>
          <div class="clock-face-wrap" data-role="clock-label">
            <svg class="clock-face" viewBox="0 0 220 220" role="img" aria-label="時計">
              <circle class="clock-face-ring" cx="110" cy="110" r="98"></circle>
              <g class="clock-face-ticks" aria-hidden="true">${this.tickMarkup()}</g>
              <text x="110" y="35" text-anchor="middle">12</text>
              <text x="188" y="117" text-anchor="middle">3</text>
              <text x="110" y="198" text-anchor="middle">6</text>
              <text x="32" y="117" text-anchor="middle">9</text>
              <line class="clock-hand clock-hand--hour" data-role="hour-hand" x1="110" y1="110" x2="110" y2="62"></line>
              <line class="clock-hand clock-hand--minute" data-role="minute-hand" x1="110" y1="110" x2="110" y2="38"></line>
              <circle class="clock-center" cx="110" cy="110" r="7"></circle>
            </svg>
          </div>
          <div class="clock-reading-choices" data-role="choices"></div>
          <div class="clock-reading-feedback hidden" data-role="feedback" aria-live="assertive"></div>
        </section>

        <section class="clock-reading-screen" data-role="history-screen">
          <h3>📊 これまでの きろく</h3>
          <div class="clock-reading-history" data-role="history-list"></div>
          <div class="clock-reading-actions">
            <button type="button" data-role="history-back">↩️ もどる</button>
            <button type="button" class="clock-reading-danger" data-role="history-clear">🗑️ けす</button>
          </div>
        </section>

        <section class="clock-reading-screen" data-role="result-screen">
          <div class="clock-reading-finish" aria-hidden="true">🏁</div>
          <h3>30びょう おしまい！</h3>
          <div class="clock-reading-result-card">
            <strong data-role="result-score">0</strong><span>てん</span>
            <p data-role="result-detail"></p>
          </div>
          <button type="button" class="clock-reading-primary" data-role="result-back">🎮 メニューへ</button>
        </section>
      </div>
    `;
  }

  private tickMarkup(): string {
    return Array.from({ length: 12 }, (_, index) => {
      const angle = index * 30;
      return `<line x1="110" y1="18" x2="110" y2="29" transform="rotate(${angle} 110 110)"></line>`;
    }).join("");
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.node<HTMLButtonElement>("start-easy").addEventListener("click", () => this.startGame("easy"));
    this.node<HTMLButtonElement>("start-normal").addEventListener("click", () => this.startGame("normal"));
    this.node<HTMLButtonElement>("start-hard").addEventListener("click", () => this.startGame("hard"));
    this.node<HTMLButtonElement>("open-history").addEventListener("click", () => this.showHistory());
    this.node<HTMLButtonElement>("history-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("history-clear").addEventListener("click", () => this.clearHistory());
    this.node<HTMLButtonElement>("result-back").addEventListener("click", () => this.showScreen("start"));
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.clockReadingBound === "true") return;
    list.dataset.clockReadingBound = "true";
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

    const note = document.getElementById("learning-path-note");
    if (note) {
      note.innerHTML = `<strong>⬇️ うえから じゅんばんに やってみよう</strong><span>${LEARNING_PATH.map((step) => step.phase).join(" → ")}</span>`;
    }

    LEARNING_PATH.forEach((step, index) => {
      const card = list.querySelector<HTMLElement>(`[data-content-id="${step.id}"]`);
      if (!card) return;
      list.appendChild(card);
      card.dataset.learningStep = String(index + 1);
      if (step.id === CONTENT_ID) card.dataset.category = "math";
      const icon = card.querySelector<HTMLElement>(".content-icon");
      if (icon) icon.textContent = step.icon;
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

    const count = list.querySelectorAll("[data-content-id]").length;
    const counter = document.querySelector<HTMLElement>(".portal-content-count");
    if (counter) {
      counter.setAttribute("aria-label", `${count}つの学習コンテンツ`);
      counter.innerHTML = `<span aria-hidden="true">🎮</span><span>${count}つ</span>`;
    }
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.stopGame();
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
    document.querySelectorAll<HTMLElement>("#main-content > section[id$='-experience']").forEach((experience) => {
      if (experience !== this.root) experience.classList.add("hidden");
    });
    this.root.classList.remove("hidden");
    this.showScreen("start");
  }

  private hideExperience(): void {
    this.stopGame();
    this.root.classList.add("hidden");
  }

  private startGame(level: ClockLevel): void {
    audioService.resume();
    this.stopGame();
    this.state.level = level;
    this.state.score = 0;
    this.state.correct = 0;
    this.state.total = 0;
    this.state.combo = 0;
    this.state.timeLeftMs = GAME_TIME_MS;
    this.state.locked = false;
    this.updateStatus();
    this.showScreen("game");
    this.nextQuestion();
    this.state.lastTimestamp = performance.now();
    this.rafId = window.requestAnimationFrame((now) => this.gameLoop(now));
  }

  private gameLoop(now: number): void {
    if (this.state.screen !== "game") return;
    const delta = now - this.state.lastTimestamp;
    this.state.lastTimestamp = now;
    this.state.timeLeftMs = Math.max(0, this.state.timeLeftMs - delta);
    this.updateTimer();
    if (this.state.timeLeftMs <= 0) {
      this.endGame();
      return;
    }
    this.rafId = window.requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  private nextQuestion(): void {
    if (this.state.screen !== "game" || this.state.timeLeftMs <= 0) return;
    this.state.question = this.createQuestion(this.state.level);
    this.state.locked = false;
    this.renderQuestion();
  }

  private createQuestion(level: ClockLevel): ClockQuestion {
    const hour = Math.floor(Math.random() * 12) + 1;
    const minutes =
      level === "easy"
        ? [0]
        : level === "normal"
          ? [0, 30]
          : Array.from({ length: 12 }, (_, index) => index * 5);
    const minute = minutes[Math.floor(Math.random() * minutes.length)] ?? 0;
    const answerKey = this.toKey(hour, minute);
    return { hour, minute, answerKey, choices: this.createChoices(answerKey, level) };
  }

  private createChoices(answerKey: number, level: ClockLevel): ClockChoice[] {
    const choices = new Set<number>([answerKey]);
    const offsets =
      level === "easy"
        ? [60, -60, 120, -120]
        : level === "normal"
          ? [30, -30, 60, -60, 90]
          : [5, -5, 10, -10, 30, -30, 60];
    for (const offset of offsets.sort(() => Math.random() - 0.5)) {
      choices.add(this.wrapKey(answerKey + offset));
      if (choices.size >= 3) break;
    }
    while (choices.size < 3) choices.add(Math.floor(Math.random() * 144) * 5);
    return Array.from(choices)
      .slice(0, 3)
      .sort(() => Math.random() - 0.5)
      .map((key) => this.fromKey(key));
  }

  private renderQuestion(): void {
    const question = this.state.question;
    if (!question) return;
    const hourAngle = (question.hour % 12) * 30 + question.minute * 0.5;
    const minuteAngle = question.minute * 6;
    this.node<SVGLineElement>("hour-hand").setAttribute("transform", `rotate(${hourAngle} 110 110)`);
    this.node<SVGLineElement>("minute-hand").setAttribute("transform", `rotate(${minuteAngle} 110 110)`);
    this.node<HTMLElement>("clock-label").setAttribute(
      "aria-label",
      `${question.hour}時${question.minute === 0 ? "" : `${question.minute}分`}の時計`,
    );

    const choices = this.node<HTMLElement>("choices");
    choices.innerHTML = "";
    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clock-reading-choice";
      button.textContent = this.timeLabel(choice.hour, choice.minute);
      button.addEventListener("click", () => this.answer(choice.key));
      choices.appendChild(button);
    });
  }

  private answer(key: number): void {
    const question = this.state.question;
    if (!question || this.state.locked || this.state.timeLeftMs <= 0) return;
    this.state.locked = true;
    this.state.total += 1;
    const correct = key === question.answerKey;
    if (correct) {
      this.state.correct += 1;
      this.state.combo += 1;
      const base = this.state.level === "easy" ? 10 : this.state.level === "normal" ? 20 : 30;
      this.state.score += base + Math.max(0, this.state.combo - 1) * 2;
      audioService.playTone({ frequency: 880, sweepToFrequency: 1320, gain: 0.1, durationMs: 220 });
      this.showFeedback(`💮 せいかい！${this.state.combo >= 2 ? ` ${this.state.combo}コンボ` : ""}`, true);
    } else {
      this.state.combo = 0;
      audioService.playTone({ frequency: 180, type: "sawtooth", gain: 0.08, durationMs: 300 });
      this.showFeedback(`✖ こたえは ${this.timeLabel(question.hour, question.minute)}`, false);
    }
    this.updateStatus();
    this.nextTimerId = window.setTimeout(() => this.nextQuestion(), correct ? 360 : 700);
  }

  private showFeedback(message: string, correct: boolean): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-correct", "is-wrong");
    feedback.classList.add(correct ? "is-correct" : "is-wrong");
    window.setTimeout(() => feedback.classList.add("hidden"), correct ? 320 : 650);
  }

  private endGame(): void {
    this.stopGame();
    this.node<HTMLElement>("result-score").textContent = String(this.state.score);
    this.node<HTMLElement>("result-detail").textContent = `${this.levelLabel(this.state.level)} ・ ${this.state.correct}/${this.state.total}もん せいかい`;
    this.saveHistory();
    this.showScreen("result");
  }

  private updateStatus(): void {
    this.node<HTMLElement>("score").textContent = String(this.state.score);
    this.node<HTMLElement>("correct").textContent = String(this.state.correct);
    this.updateTimer();
  }

  private updateTimer(): void {
    this.node<HTMLElement>("timer").textContent = (this.state.timeLeftMs / 1000).toFixed(1);
    this.node<HTMLElement>("timer-fill").style.width = `${Math.max(0, this.state.timeLeftMs / GAME_TIME_MS) * 100}%`;
  }

  private showHistory(): void {
    this.renderHistory();
    this.showScreen("history");
  }

  private loadHistory(): ClockHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is ClockHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<ClockHistoryRecord>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          (row.level === "easy" || row.level === "normal" || row.level === "hard") &&
          typeof row.levelLabel === "string" &&
          typeof row.score === "number" &&
          typeof row.correct === "number" &&
          typeof row.total === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private saveHistory(): void {
    const now = new Date();
    const history = this.loadHistory();
    history.unshift({
      id: Date.now(),
      date: `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      level: this.state.level,
      levelLabel: this.levelLabel(this.state.level),
      score: this.state.score,
      correct: this.state.correct,
      total: this.state.total,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  private renderHistory(): void {
    const history = this.loadHistory();
    const list = this.node<HTMLElement>("history-list");
    if (history.length === 0) {
      list.innerHTML = '<p class="clock-reading-empty">まだ きろくが ないよ</p>';
      return;
    }
    list.innerHTML = history
      .map(
        (row) => `
          <article class="clock-reading-history-item">
            <div><strong>${row.levelLabel}</strong><span>${row.date}</span></div>
            <p>${row.correct}/${row.total}もん</p>
            <b>${row.score}てん</b>
          </article>
        `,
      )
      .join("");
  }

  private clearHistory(): void {
    if (!window.confirm("とけいの きろくを ぜんぶ けす？")) return;
    localStorage.removeItem(STORAGE_KEY);
    this.renderHistory();
  }

  private showScreen(screen: ClockScreen): void {
    this.state.screen = screen;
    this.node<HTMLElement>("start-screen").classList.toggle("is-active", screen === "start");
    this.node<HTMLElement>("game-screen").classList.toggle("is-active", screen === "game");
    this.node<HTMLElement>("history-screen").classList.toggle("is-active", screen === "history");
    this.node<HTMLElement>("result-screen").classList.toggle("is-active", screen === "result");
  }

  private stopGame(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.nextTimerId !== null) {
      window.clearTimeout(this.nextTimerId);
      this.nextTimerId = null;
    }
  }

  private toKey(hour: number, minute: number): number {
    return ((hour % 12) * 60 + minute) % 720;
  }

  private wrapKey(key: number): number {
    return ((key % 720) + 720) % 720;
  }

  private fromKey(key: number): ClockChoice {
    const normalized = this.wrapKey(key);
    const hour24 = Math.floor(normalized / 60);
    return { key: normalized, hour: hour24 === 0 ? 12 : hour24, minute: normalized % 60 };
  }

  private timeLabel(hour: number, minute: number): string {
    if (minute === 0) return `${hour}じ`;
    return `${hour}じ ${minute}ふん`;
  }

  private levelLabel(level: ClockLevel): string {
    if (level === "easy") return "やさしい";
    if (level === "normal") return "ふつう";
    return "むずかしい";
  }

  private node<T extends Element>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!element) throw new Error(`Missing clock-reading node: ${role}`);
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

function initClockReading(): void {
  if (document.getElementById("clock-reading-experience")) return;
  const game = new ClockReadingGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.requestAnimationFrame(initClockReading), { once: true });
} else {
  window.requestAnimationFrame(initClockReading);
}
