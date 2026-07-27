import { audioService } from "./app/audio";
import "./styles/number-sequence.scss";

type SequenceLevel = "easy" | "normal" | "hard";
type Screen = "start" | "game" | "history" | "result";

interface SequenceQuestion {
  values: Array<number | null>;
  answer: number;
  choices: number[];
}

interface SequenceHistoryRecord {
  id: number;
  date: string;
  level: SequenceLevel;
  levelLabel: string;
  score: number;
  correct: number;
  total: number;
}

interface SequenceState {
  level: SequenceLevel;
  screen: Screen;
  score: number;
  correct: number;
  total: number;
  combo: number;
  timeLeftMs: number;
  lastTimestamp: number;
  locked: boolean;
  question: SequenceQuestion | null;
}

const CONTENT_ID = "number-sequence";
const STORAGE_KEY = "number_sequence_v1_history";
const GAME_TIME_MS = 30_000;
const MAX_HISTORY = 50;
const PATH_ORDER = ["fit-shape", "flashcard", "dotburst", CONTENT_ID, "larger-number", "kakitori"] as const;

class NumberSequenceGame {
  private readonly root: HTMLElement;
  private readonly state: SequenceState = {
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
  private readonly portalPath: string;

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "number-sequence-experience";
    this.root.className = "number-sequence-experience hidden";
    this.root.setAttribute("aria-label", "数の並びゲーム");
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
      <div class="number-sequence-shell">
        <header class="number-sequence-header">
          <div>
            <p class="number-sequence-step">STEP 4</p>
            <h2>🔢 かずの ならび</h2>
          </div>
          <button type="button" class="number-sequence-back" data-role="back-portal" aria-label="学びの一覧にもどる">
            🏠 いちらん
          </button>
        </header>

        <section class="number-sequence-screen is-active" data-role="start-screen">
          <div class="number-sequence-hero" aria-hidden="true">1️⃣ 2️⃣ ❓ 4️⃣</div>
          <h3>ぬけている かずを えらぼう</h3>
          <p class="number-sequence-limit">⏱️ どのレベルも 30びょうで おしまい</p>
          <div class="number-sequence-levels">
            <button type="button" data-role="start-easy">🐣 やさしい<br><small>10まで・1ずつ</small></button>
            <button type="button" data-role="start-normal">🦁 ふつう<br><small>20まで・1か2ずつ</small></button>
            <button type="button" data-role="start-hard">🚀 むずかしい<br><small>100まで・2か5か10ずつ</small></button>
          </div>
          <button type="button" class="number-sequence-sub" data-role="open-history">📊 きろくを みる</button>
        </section>

        <section class="number-sequence-screen" data-role="game-screen">
          <div class="number-sequence-status">
            <span>⭐ <strong data-role="score">0</strong>てん</span>
            <span>⭕ <strong data-role="correct">0</strong>もん</span>
            <span>⏱️ <strong data-role="timer">30.0</strong></span>
          </div>
          <div class="number-sequence-timer-track" aria-label="のこり時間">
            <div class="number-sequence-timer-fill" data-role="timer-fill"></div>
          </div>
          <p class="number-sequence-instruction">❓に はいる かずは どれ？</p>
          <div class="number-sequence-row" data-role="sequence-row" aria-live="polite"></div>
          <div class="number-sequence-choices" data-role="choices"></div>
          <div class="number-sequence-feedback hidden" data-role="feedback" aria-live="assertive"></div>
        </section>

        <section class="number-sequence-screen" data-role="history-screen">
          <h3>📊 これまでの きろく</h3>
          <div class="number-sequence-history" data-role="history-list"></div>
          <div class="number-sequence-result-actions">
            <button type="button" data-role="history-back">↩️ もどる</button>
            <button type="button" class="number-sequence-danger" data-role="history-clear">🗑️ けす</button>
          </div>
        </section>

        <section class="number-sequence-screen" data-role="result-screen">
          <div class="number-sequence-finish" aria-hidden="true">🏁</div>
          <h3>30びょう おしまい！</h3>
          <div class="number-sequence-result-card">
            <strong data-role="result-score">0</strong><span>てん</span>
            <p data-role="result-detail"></p>
          </div>
          <button type="button" class="number-sequence-primary" data-role="result-back">🎮 メニューへ</button>
        </section>
      </div>
    `;
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
    if (!list || list.dataset.numberSequenceBound === "true") return;
    list.dataset.numberSequenceBound = "true";
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
    if (!document.getElementById(noteId)) {
      const note = document.createElement("div");
      note.id = noteId;
      note.className = "learning-path-note";
      note.innerHTML = '<strong>⬇️ うえから じゅんばんに やってみよう</strong><span>みる → おぼえる → かず → ならび → くらべる → かく</span>';
      list.before(note);
    }

    PATH_ORDER.forEach((contentId, index) => {
      const card = list.querySelector<HTMLElement>(`[data-content-id="${contentId}"]`);
      if (!card) return;
      list.appendChild(card);
      card.dataset.learningStep = String(index + 1);
      if (contentId === CONTENT_ID) {
        card.dataset.category = "math";
        const icon = card.querySelector<HTMLElement>(".content-icon");
        if (icon) icon.textContent = "🔢";
      }

      const top = card.querySelector<HTMLElement>(".content-card-top");
      if (top && !top.querySelector(".content-step-badge")) {
        const badge = document.createElement("span");
        badge.className = "content-step-badge";
        badge.textContent = `STEP ${index + 1}`;
        top.appendChild(badge);
      }
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
    const portal = document.getElementById("view-portal");
    portal?.classList.remove("hidden");
  }

  private syncFromLocation(): void {
    if (this.isCurrentPath()) {
      this.showExperience();
    } else {
      this.hideExperience();
    }
  }

  private showExperience(): void {
    document.querySelectorAll<HTMLElement>("#main-content > .view").forEach((view) => view.classList.add("hidden"));
    this.root.classList.remove("hidden");
    this.showScreen("start");
  }

  private hideExperience(): void {
    this.stopGame();
    this.root.classList.add("hidden");
  }

  private startGame(level: SequenceLevel): void {
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

  private createQuestion(level: SequenceLevel): SequenceQuestion {
    const config =
      level === "easy"
        ? { max: 10, length: 4, steps: [1] }
        : level === "normal"
          ? { max: 20, length: 4, steps: [1, 2] }
          : { max: 100, length: 5, steps: [2, 5, 10] };
    const step = config.steps[Math.floor(Math.random() * config.steps.length)] ?? 1;
    const maxStart = Math.max(1, config.max - step * (config.length - 1));
    const start = Math.floor(Math.random() * maxStart) + 1;
    const sequence = Array.from({ length: config.length }, (_, index) => start + index * step);
    const blankIndex = Math.floor(Math.random() * config.length);
    const answer = sequence[blankIndex] ?? start;
    const values: Array<number | null> = sequence.map((value, index) => (index === blankIndex ? null : value));
    const choices = this.createChoices(answer, step, config.max);
    return { values, answer, choices };
  }

  private createChoices(answer: number, step: number, max: number): number[] {
    const choices = new Set<number>([answer]);
    const offsets = [step, -step, step * 2, -step * 2, 1, -1];
    for (const offset of offsets.sort(() => Math.random() - 0.5)) {
      const value = answer + offset;
      if (value >= 1 && value <= max) choices.add(value);
      if (choices.size >= 3) break;
    }
    while (choices.size < 3) {
      choices.add(Math.floor(Math.random() * max) + 1);
    }
    return Array.from(choices).sort(() => Math.random() - 0.5);
  }

  private renderQuestion(): void {
    const question = this.state.question;
    if (!question) return;
    const row = this.node<HTMLElement>("sequence-row");
    row.innerHTML = question.values
      .map((value) => `<span class="number-sequence-cell ${value === null ? "is-blank" : ""}">${value ?? "❓"}</span>`)
      .join('<span class="number-sequence-arrow" aria-hidden="true">→</span>');

    const choices = this.node<HTMLElement>("choices");
    choices.innerHTML = "";
    question.choices.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number-sequence-choice";
      button.textContent = String(value);
      button.addEventListener("click", () => this.answer(value));
      choices.appendChild(button);
    });
  }

  private answer(value: number): void {
    const question = this.state.question;
    if (!question || this.state.locked || this.state.timeLeftMs <= 0) return;
    this.state.locked = true;
    this.state.total += 1;
    const correct = value === question.answer;
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
      this.showFeedback(`✖ こたえは ${question.answer}`, false);
    }
    this.updateStatus();
    this.nextTimerId = window.setTimeout(() => this.nextQuestion(), correct ? 360 : 650);
  }

  private showFeedback(message: string, correct: boolean): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-correct", "is-wrong");
    feedback.classList.add(correct ? "is-correct" : "is-wrong");
    window.setTimeout(() => feedback.classList.add("hidden"), correct ? 320 : 600);
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
    const ratio = Math.max(0, this.state.timeLeftMs / GAME_TIME_MS);
    this.node<HTMLElement>("timer-fill").style.width = `${ratio * 100}%`;
  }

  private showHistory(): void {
    this.renderHistory();
    this.showScreen("history");
  }

  private loadHistory(): SequenceHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is SequenceHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<SequenceHistoryRecord>;
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
      list.innerHTML = '<p class="number-sequence-empty">まだ きろくが ないよ</p>';
      return;
    }
    list.innerHTML = history
      .map(
        (row) => `
          <article class="number-sequence-history-item">
            <div><strong>${row.levelLabel}</strong><span>${row.date}</span></div>
            <p>${row.correct}/${row.total}もん</p>
            <b>${row.score}てん</b>
          </article>
        `,
      )
      .join("");
  }

  private clearHistory(): void {
    if (!window.confirm("かずの ならびの きろくを ぜんぶ けす？")) return;
    localStorage.removeItem(STORAGE_KEY);
    this.renderHistory();
  }

  private showScreen(screen: Screen): void {
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

  private levelLabel(level: SequenceLevel): string {
    if (level === "easy") return "やさしい";
    if (level === "normal") return "ふつう";
    return "むずかしい";
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing number-sequence node: ${role}`);
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

function initNumberSequence(): void {
  const game = new NumberSequenceGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNumberSequence, { once: true });
} else {
  initNumberSequence();
}
