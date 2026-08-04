import { audioService } from "./app/audio";
import "./styles/hundred-abacus.scss";

type AbacusMode = "problem" | "free";
type AbacusLevel = "to10" | "to20" | "to100";
type AbacusScreen = "start" | "level" | "problem" | "free" | "history" | "result";
type QuestionKind = "make" | "read";

interface AbacusQuestion {
  kind: QuestionKind;
  target: number;
  choices: number[];
}

interface AbacusHistoryRecord {
  id: number;
  completedAt: string;
  mode: AbacusMode;
  level: AbacusLevel | null;
  independentCount: number | null;
  assistedCount: number | null;
  totalQuestions: number | null;
  durationSeconds: number;
  operationCount: number;
  finalValue: number;
}

interface AbacusState {
  screen: AbacusScreen;
  mode: AbacusMode;
  level: AbacusLevel;
  value: number;
  questions: AbacusQuestion[];
  questionIndex: number;
  independentCount: number;
  assistedCount: number;
  operationCount: number;
  usedHint: boolean;
  hintLevel: number;
  locked: boolean;
  timeLeftMs: number;
  lastTimestamp: number;
}

const CONTENT_ID = "hundred-abacus";
const STORAGE_KEY = "hundred_abacus_v1_history";
const MAX_HISTORY = 50;
const QUESTION_COUNT = 10;
const FREE_TIME_MS = 180_000;
const LEARNING_PATH = [
  { id: "fit-shape", icon: "🧩", category: "shape", phase: "みる" },
  { id: "flashcard", icon: "🧠", category: "memory", phase: "おぼえる" },
  { id: "dotburst", icon: "🟡", category: "math", phase: "かず" },
  { id: CONTENT_ID, icon: "🧮", category: "math", phase: "そろばん" },
  { id: "number-sequence", icon: "🔢", category: "math", phase: "ならび" },
  { id: "larger-number", icon: "⚖️", category: "math", phase: "くらべる" },
  { id: "clock-reading", icon: "🕐", category: "math", phase: "とけい" },
  { id: "pencil-practice", icon: "🖍️", category: "language", phase: "せん" },
  { id: "kakitori", icon: "✏️", category: "language", phase: "かく" },
] as const;

class HundredAbacusGame {
  private readonly root: HTMLElement;
  private readonly portalPath: string;
  private readonly state: AbacusState = {
    screen: "start",
    mode: "problem",
    level: "to10",
    value: 0,
    questions: [],
    questionIndex: 0,
    independentCount: 0,
    assistedCount: 0,
    operationCount: 0,
    usedHint: false,
    hintLevel: 0,
    locked: false,
    timeLeftMs: FREE_TIME_MS,
    lastTimestamp: 0,
  };
  private rafId: number | null = null;
  private nextTimerId: number | null = null;
  private matchTimerId: number | null = null;
  private dragging = false;
  private lastBeadToneAt = 0;
  private wrongChoices = new Set<number>();

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "hundred-abacus-experience";
    this.root.className = "hundred-abacus-experience hidden";
    this.root.setAttribute("aria-label", "100そろばん");
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
    window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    window.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    window.addEventListener("pointercancel", () => {
      this.dragging = false;
    });
    this.syncFromLocation();
  }

  private template(): string {
    return `
      <div class="hundred-abacus-shell">
        <header class="hundred-abacus-header">
          <div>
            <p class="hundred-abacus-step">STEP 4</p>
            <h2>🧮 100そろばん</h2>
          </div>
          <button type="button" class="hundred-abacus-back" data-role="back-portal" aria-label="学びの一覧にもどる">
            🏠 いちらん
          </button>
        </header>

        <section class="hundred-abacus-screen is-active" data-role="start-screen">
          <div class="hundred-abacus-hero" aria-hidden="true">🔴🔴🔴🔴🔴</div>
          <h3>たまを うごかして<br>100までの かずを みよう</h3>
          <div class="hundred-abacus-mode-grid">
            <button type="button" class="hundred-abacus-mode-button" data-role="choose-problem">
              <span aria-hidden="true">🎯</span>
              <strong>もんだい</strong>
              <small>10もんで おしまい</small>
            </button>
            <button type="button" class="hundred-abacus-mode-button" data-role="start-free">
              <span aria-hidden="true">👐</span>
              <strong>じゆうに うごかす</strong>
              <small>3ぷんで おしまい</small>
            </button>
          </div>
          <button type="button" class="hundred-abacus-sub" data-role="open-history">📊 きろくを みる</button>
        </section>

        <section class="hundred-abacus-screen" data-role="level-screen">
          <div class="hundred-abacus-hero" aria-hidden="true">🎯</div>
          <h3>どこまでの かずにする？</h3>
          <p class="hundred-abacus-limit">✅ どのレベルも 10もんで おしまい</p>
          <div class="hundred-abacus-level-grid">
            <button type="button" data-level="to10">🐣 10まで</button>
            <button type="button" data-level="to20">🦁 20まで</button>
            <button type="button" data-level="to100">🚀 100まで</button>
          </div>
          <button type="button" class="hundred-abacus-sub" data-role="level-back">↩️ もどる</button>
        </section>

        <section class="hundred-abacus-screen" data-role="problem-screen">
          <div class="hundred-abacus-progress">
            <strong data-role="problem-progress">1 / 10</strong>
            <div class="hundred-abacus-progress-track" aria-label="問題の進み具合">
              <div class="hundred-abacus-progress-fill" data-role="problem-progress-fill"></div>
            </div>
          </div>
          <p class="hundred-abacus-question-kind" data-role="question-kind"></p>
          <h3 class="hundred-abacus-question" data-role="question-text"></h3>
          <div class="hundred-abacus-value-card" aria-live="polite">
            <strong data-role="problem-value">0</strong>
            <span data-role="problem-summary">10が0こ　1が0こ</span>
          </div>
          <div class="hundred-abacus-board" data-role="problem-abacus" tabindex="0" aria-label="100そろばん"></div>
          <div class="hundred-abacus-choices" data-role="problem-choices"></div>
          <p class="hundred-abacus-hint-text hidden" data-role="problem-hint" aria-live="polite"></p>
          <div class="hundred-abacus-feedback hidden" data-role="problem-feedback" aria-live="assertive"></div>
          <div class="hundred-abacus-game-actions">
            <button type="button" data-role="problem-reset">↩️ 0にもどす</button>
            <button type="button" class="hundred-abacus-hint" data-role="problem-hint-button">💡 わからない</button>
          </div>
        </section>

        <section class="hundred-abacus-screen" data-role="free-screen">
          <div class="hundred-abacus-free-status">
            <span>👐 じゆうモード</span>
            <strong>⏱️ <span data-role="free-timer">3:00</span></strong>
          </div>
          <div class="hundred-abacus-progress-track" aria-label="のこり時間">
            <div class="hundred-abacus-progress-fill" data-role="free-timer-fill"></div>
          </div>
          <p class="hundred-abacus-touch-guide" data-role="free-guide">👆 たまを タップしてみよう</p>
          <div class="hundred-abacus-value-card" aria-live="polite">
            <strong data-role="free-value">0</strong>
            <span data-role="free-summary">10が0こ　1が0こ</span>
          </div>
          <div class="hundred-abacus-board" data-role="free-abacus" tabindex="0" aria-label="自由に動かせる100そろばん"></div>
          <button type="button" class="hundred-abacus-reset" data-role="free-reset">↩️ 0にもどす</button>
        </section>

        <section class="hundred-abacus-screen" data-role="history-screen">
          <h3>📊 これまでの きろく</h3>
          <div class="hundred-abacus-history" data-role="history-list"></div>
          <button type="button" class="hundred-abacus-sub" data-role="history-back">↩️ もどる</button>
        </section>

        <section class="hundred-abacus-screen" data-role="result-screen">
          <div class="hundred-abacus-finish" aria-hidden="true">🏁</div>
          <h3 data-role="result-title">おしまい！</h3>
          <div class="hundred-abacus-result-card">
            <div class="hundred-abacus-stars" data-role="result-stars"></div>
            <strong data-role="result-main"></strong>
            <p data-role="result-detail"></p>
          </div>
          <div class="hundred-abacus-result-actions">
            <button type="button" class="hundred-abacus-primary" data-role="result-retry">🔁 もういちど</button>
            <button type="button" data-role="result-menu">🎮 モードをえらぶ</button>
            <button type="button" data-role="result-portal">🏠 いちらんへ</button>
          </div>
        </section>
      </div>
    `;
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.node<HTMLButtonElement>("choose-problem").addEventListener("click", () => this.showScreen("level"));
    this.node<HTMLButtonElement>("start-free").addEventListener("click", () => this.startFree());
    this.node<HTMLButtonElement>("level-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("open-history").addEventListener("click", () => this.showHistory());
    this.node<HTMLButtonElement>("history-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("problem-reset").addEventListener("click", () => this.setValue(0, true));
    this.node<HTMLButtonElement>("problem-hint-button").addEventListener("click", () => this.showHint());
    this.node<HTMLButtonElement>("free-reset").addEventListener("click", () => this.setValue(0, true));
    this.node<HTMLButtonElement>("result-retry").addEventListener("click", () => this.retry());
    this.node<HTMLButtonElement>("result-menu").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("result-portal").addEventListener("click", () => this.closeToPortal());

    this.root.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
      button.addEventListener("click", () => {
        const level = button.dataset.level;
        if (level === "to10" || level === "to20" || level === "to100") {
          this.startProblem(level);
        }
      });
    });

    this.node<HTMLElement>("problem-choices").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest<HTMLButtonElement>("[data-choice]");
      if (!button || button.disabled) return;
      const value = Number(button.dataset.choice);
      if (Number.isFinite(value)) this.answerReadQuestion(value);
    });

    this.root.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.node<HTMLElement>("problem-abacus").addEventListener("keydown", (event) => this.handleBoardKeydown(event));
    this.node<HTMLElement>("free-abacus").addEventListener("keydown", (event) => this.handleBoardKeydown(event));
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.hundredAbacusBound === "true") return;
    list.dataset.hundredAbacusBound = "true";
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

    let note = document.getElementById("learning-path-note");
    if (!note) {
      note = document.createElement("div");
      note.id = "learning-path-note";
      note.className = "learning-path-note";
      list.before(note);
    }
    note.innerHTML = `<strong>⬇️ うえから じゅんばんに やってみよう</strong><span>${LEARNING_PATH.map((item) => item.phase).join(" → ")}</span>`;

    LEARNING_PATH.forEach((item, index) => {
      const card = list.querySelector<HTMLElement>(`[data-content-id="${item.id}"]`);
      if (!card) return;
      list.appendChild(card);
      card.dataset.learningStep = String(index + 1);
      card.dataset.category = item.category;
      const icon = card.querySelector<HTMLElement>(".content-icon");
      if (icon) icon.textContent = item.icon;
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
      counter.setAttribute("aria-label", "9つの学習コンテンツ");
      counter.innerHTML = '<span aria-hidden="true">🎮</span><span>9つ</span>';
    }

    this.replaceText(".number-sequence-step", "STEP 5");
    this.replaceText(".clock-reading-step", "STEP 7");
    this.replaceText(".pencil-practice-step", "STEP 8");
  }

  private replaceText(selector: string, value: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.stopSession();
    window.history.pushState(null, "", this.portalPath);
    this.root.classList.add("hidden");
    document.getElementById("view-portal")?.classList.remove("hidden");
  }

  private syncFromLocation(): void {
    if (this.isCurrentPath()) {
      this.showExperience();
    } else {
      this.stopSession();
      this.root.classList.add("hidden");
    }
  }

  private showExperience(): void {
    document.querySelectorAll<HTMLElement>("#main-content > section").forEach((section) => {
      section.classList.toggle("hidden", section !== this.root);
    });
    this.root.classList.remove("hidden");
    this.showScreen("start");
  }

  private startProblem(level: AbacusLevel): void {
    audioService.resume();
    this.stopSession();
    this.state.mode = "problem";
    this.state.level = level;
    this.state.questions = this.createQuestions(level);
    this.state.questionIndex = 0;
    this.state.independentCount = 0;
    this.state.assistedCount = 0;
    this.state.operationCount = 0;
    this.showScreen("problem");
    this.prepareQuestion();
  }

  private prepareQuestion(): void {
    const question = this.currentQuestion();
    if (!question) {
      this.finishProblem();
      return;
    }
    this.clearPendingTimers();
    this.wrongChoices.clear();
    this.state.usedHint = false;
    this.state.hintLevel = 0;
    this.state.locked = false;
    this.state.value = question.kind === "read" ? question.target : question.target === 0 ? 1 : 0;
    this.node<HTMLElement>("problem-feedback").classList.add("hidden");
    this.node<HTMLElement>("problem-hint").classList.add("hidden");
    this.renderProblem();
  }

  private renderProblem(): void {
    const question = this.currentQuestion();
    if (!question) return;

    const progress = this.state.questionIndex + 1;
    this.node<HTMLElement>("problem-progress").textContent = `${progress} / ${QUESTION_COUNT}`;
    this.node<HTMLElement>("problem-progress-fill").style.width = `${(progress / QUESTION_COUNT) * 100}%`;
    this.node<HTMLElement>("question-kind").textContent = question.kind === "make" ? "🎯 かずを つくる" : "👀 かずを よむ";
    this.node<HTMLElement>("question-text").textContent = question.kind === "make" ? `「${question.target}」に してみよう` : "この かずは いくつ？";
    this.updateValueDisplays();
    this.renderAbacus("problem-abacus", question.kind === "make" && !this.state.locked);
    this.renderChoices();
    this.node<HTMLButtonElement>("problem-reset").classList.toggle("hidden", question.kind !== "make");
  }

  private renderChoices(): void {
    const question = this.currentQuestion();
    const container = this.node<HTMLElement>("problem-choices");
    if (!question || question.kind !== "read") {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    container.innerHTML = question.choices
      .map((choice) => {
        const wrong = this.wrongChoices.has(choice);
        return `<button type="button" data-choice="${choice}" ${wrong ? "disabled" : ""} class="${wrong ? "is-wrong" : ""}">${choice}</button>`;
      })
      .join("");
  }

  private startFree(): void {
    audioService.resume();
    this.stopSession();
    this.state.mode = "free";
    this.state.value = 0;
    this.state.operationCount = 0;
    this.state.timeLeftMs = FREE_TIME_MS;
    this.state.lastTimestamp = performance.now();
    this.node<HTMLElement>("free-guide").classList.remove("hidden");
    this.showScreen("free");
    this.updateFreeView();
    this.rafId = window.requestAnimationFrame((now) => this.freeLoop(now));
  }

  private freeLoop(now: number): void {
    if (this.state.screen !== "free") return;
    const delta = now - this.state.lastTimestamp;
    this.state.lastTimestamp = now;
    this.state.timeLeftMs = Math.max(0, this.state.timeLeftMs - delta);
    this.updateFreeTimer();
    if (this.state.timeLeftMs <= 0) {
      this.finishFree();
      return;
    }
    this.rafId = window.requestAnimationFrame((timestamp) => this.freeLoop(timestamp));
  }

  private updateFreeView(): void {
    this.updateValueDisplays();
    this.renderAbacus("free-abacus", true);
    this.updateFreeTimer();
  }

  private updateFreeTimer(): void {
    const totalSeconds = Math.ceil(this.state.timeLeftMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    this.node<HTMLElement>("free-timer").textContent = `${minutes}:${seconds}`;
    this.node<HTMLElement>("free-timer-fill").style.width = `${Math.max(0, this.state.timeLeftMs / FREE_TIME_MS) * 100}%`;
  }

  private handlePointerDown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const bead = target.closest<HTMLElement>("[data-abacus-value]");
    if (!bead || !this.canMoveAbacus()) return;
    const value = Number(bead.dataset.abacusValue);
    if (!Number.isFinite(value)) return;
    event.preventDefault();
    this.dragging = true;
    this.setValue(value, true);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragging || !this.canMoveAbacus()) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!(element instanceof HTMLElement)) return;
    const bead = element.closest<HTMLElement>("[data-abacus-value]");
    if (!bead || !this.root.contains(bead)) return;
    const value = Number(bead.dataset.abacusValue);
    if (Number.isFinite(value)) this.setValue(value, true);
  }

  private handleBoardKeydown(event: KeyboardEvent): void {
    if (!this.canMoveAbacus()) return;
    let next = this.state.value;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
    else if (event.key === "PageUp") next += 10;
    else if (event.key === "PageDown") next -= 10;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = this.state.screen === "free" ? 100 : this.levelMax(this.state.level);
    else return;
    event.preventDefault();
    this.setValue(next, true);
  }

  private canMoveAbacus(): boolean {
    if (this.state.screen === "free") return true;
    const question = this.currentQuestion();
    return this.state.screen === "problem" && question?.kind === "make" && !this.state.locked;
  }

  private setValue(value: number, userAction: boolean): void {
    const max = this.state.screen === "free" ? 100 : this.levelMax(this.state.level);
    const next = Math.max(0, Math.min(max, Math.round(value)));
    if (next === this.state.value) return;
    this.state.value = next;
    if (userAction) {
      this.state.operationCount += 1;
      if (this.state.screen === "free") this.node<HTMLElement>("free-guide").classList.add("hidden");
      this.playBeadTone();
    }
    if (this.state.screen === "problem") {
      this.renderProblem();
      this.checkMakeAnswer();
    } else if (this.state.screen === "free") {
      this.updateFreeView();
    }
  }

  private playBeadTone(): void {
    const now = performance.now();
    if (now - this.lastBeadToneAt < 70) return;
    this.lastBeadToneAt = now;
    audioService.playTone({ frequency: 430, gain: 0.035, durationMs: 55 });
  }

  private checkMakeAnswer(): void {
    const question = this.currentQuestion();
    if (!question || question.kind !== "make" || this.state.locked) return;
    if (this.matchTimerId !== null) {
      window.clearTimeout(this.matchTimerId);
      this.matchTimerId = null;
    }
    if (this.state.value !== question.target) return;
    this.matchTimerId = window.setTimeout(() => {
      this.matchTimerId = null;
      if (this.state.value === question.target) this.completeQuestion(this.state.usedHint);
    }, 600);
  }

  private answerReadQuestion(value: number): void {
    const question = this.currentQuestion();
    if (!question || question.kind !== "read" || this.state.locked) return;
    if (value === question.target) {
      this.completeQuestion(this.state.usedHint);
      return;
    }
    this.wrongChoices.add(value);
    this.renderChoices();
    this.showProblemFeedback("もういちど みてみよう", false);
    audioService.playTone({ frequency: 240, gain: 0.04, durationMs: 120 });
  }

  private showHint(): void {
    const question = this.currentQuestion();
    if (!question || this.state.locked) return;
    this.state.usedHint = true;
    this.state.hintLevel += 1;
    const hint = this.node<HTMLElement>("problem-hint");
    hint.classList.remove("hidden");
    const { tens, ones } = this.decompose(question.target);

    if (this.state.hintLevel === 1) {
      hint.textContent = question.kind === "read" ? `10この だんを かぞえてみよう。いっぱいの だんは ${tens}こ。` : `10が ${tens}こ、1が ${ones}こ だよ。`;
      return;
    }
    if (this.state.hintLevel === 2) {
      hint.textContent = `10が ${tens}こ と、1が ${ones}こ。あわせると いくつかな？`;
      return;
    }

    hint.textContent = `こたえは ${question.target} だよ。`;
    this.state.value = question.target;
    this.renderProblem();
    this.nextTimerId = window.setTimeout(() => this.completeQuestion(true), 900);
  }

  private completeQuestion(assisted: boolean): void {
    if (this.state.locked) return;
    this.state.locked = true;
    this.clearPendingTimers();
    if (assisted) this.state.assistedCount += 1;
    else this.state.independentCount += 1;
    audioService.playTone({ frequency: 880, sweepToFrequency: 1320, gain: 0.09, durationMs: 220 });
    this.showProblemFeedback(assisted ? "💮 ヒントで できた！" : "💮 ひとりで できた！", true);
    this.renderProblem();
    this.nextTimerId = window.setTimeout(() => {
      this.state.questionIndex += 1;
      if (this.state.questionIndex >= QUESTION_COUNT) this.finishProblem();
      else this.prepareQuestion();
    }, 750);
  }

  private finishProblem(): void {
    this.stopSession();
    this.saveHistory({
      mode: "problem",
      level: this.state.level,
      independentCount: this.state.independentCount,
      assistedCount: this.state.assistedCount,
      totalQuestions: QUESTION_COUNT,
      durationSeconds: 0,
      operationCount: this.state.operationCount,
      finalValue: this.state.value,
    });
    const stars = this.state.independentCount === 10 ? "⭐⭐⭐" : this.state.independentCount >= 7 ? "⭐⭐" : "⭐";
    this.node<HTMLElement>("result-title").textContent = "10もん おしまい！";
    this.node<HTMLElement>("result-stars").textContent = stars;
    this.node<HTMLElement>("result-main").textContent = `ひとりで ${this.state.independentCount}もん`;
    this.node<HTMLElement>("result-detail").textContent = `ヒントで ${this.state.assistedCount}もん できたよ`;
    this.showScreen("result");
  }

  private finishFree(): void {
    this.stopSession();
    this.saveHistory({
      mode: "free",
      level: null,
      independentCount: null,
      assistedCount: null,
      totalQuestions: null,
      durationSeconds: FREE_TIME_MS / 1000,
      operationCount: this.state.operationCount,
      finalValue: this.state.value,
    });
    this.node<HTMLElement>("result-title").textContent = "3ぷん おしまい！";
    this.node<HTMLElement>("result-stars").textContent = "";
    this.node<HTMLElement>("result-main").textContent = `たまを ${this.state.operationCount}かい うごかしたよ`;
    this.node<HTMLElement>("result-detail").textContent = `さいごの かずは ${this.state.value}`;
    this.showScreen("result");
  }

  private retry(): void {
    if (this.state.mode === "free") this.startFree();
    else this.startProblem(this.state.level);
  }

  private renderAbacus(role: "problem-abacus" | "free-abacus", interactive: boolean): void {
    const container = this.node<HTMLElement>(role);
    const rows = Array.from({ length: 10 }, (_, rowIndex) => {
      const rowStart = rowIndex * 10;
      const filled = Math.max(0, Math.min(10, this.state.value - rowStart));
      const beads = Array.from({ length: 10 }, (_, beadIndex) => {
        const beadValue = rowStart + beadIndex + 1;
        const active = beadIndex < filled;
        const max = this.state.screen === "free" ? 100 : this.levelMax(this.state.level);
        const enabled = beadValue <= max;
        const tag = interactive && enabled ? "button" : "span";
        const attributes = interactive && enabled
          ? `type="button" tabindex="-1" data-abacus-value="${beadValue}" aria-label="${beadValue}にする"`
          : 'aria-hidden="true"';
        const classes = ["hundred-abacus-bead", active ? "is-active" : "", enabled ? "" : "is-disabled"].filter(Boolean).join(" ");
        return `${beadIndex === 5 ? '<span class="hundred-abacus-gap" aria-hidden="true"></span>' : ""}<${tag} ${attributes} class="${classes}"></${tag}>`;
      }).join("");
      return `<div class="hundred-abacus-row" role="group" aria-label="${rowIndex + 1}だんめ、${filled}こ">${beads}</div>`;
    }).join("");
    container.innerHTML = rows;
    container.classList.toggle("is-interactive", interactive);
    container.setAttribute("aria-valuemin", "0");
    container.setAttribute("aria-valuemax", String(this.state.screen === "free" ? 100 : this.levelMax(this.state.level)));
    container.setAttribute("aria-valuenow", String(this.state.value));
  }

  private updateValueDisplays(): void {
    const summary = this.summaryText(this.state.value);
    if (this.state.screen === "problem") {
      this.node<HTMLElement>("problem-value").textContent = String(this.state.value);
      this.node<HTMLElement>("problem-summary").textContent = summary;
    }
    if (this.state.screen === "free") {
      this.node<HTMLElement>("free-value").textContent = String(this.state.value);
      this.node<HTMLElement>("free-summary").textContent = summary;
    }
  }

  private summaryText(value: number): string {
    const { tens, ones } = this.decompose(value);
    return `10が${tens}こ　1が${ones}こ`;
  }

  private decompose(value: number): { tens: number; ones: number } {
    return { tens: Math.floor(value / 10), ones: value % 10 };
  }

  private showProblemFeedback(message: string, correct: boolean): void {
    const feedback = this.node<HTMLElement>("problem-feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden", "is-correct", "is-wrong");
    feedback.classList.add(correct ? "is-correct" : "is-wrong");
  }

  private currentQuestion(): AbacusQuestion | null {
    return this.state.questions[this.state.questionIndex] ?? null;
  }

  private createQuestions(level: AbacusLevel): AbacusQuestion[] {
    const targets = this.createTargets(this.levelMax(level));
    let kinds: QuestionKind[] = ["make", "make", "make", "make", "make", "read", "read", "read", "read", "read"];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      kinds = this.shuffle(kinds);
      if (!this.hasLongRun(kinds)) break;
    }
    return targets.map((target, index) => ({
      kind: kinds[index] ?? "make",
      target,
      choices: this.createChoices(target, this.levelMax(level)),
    }));
  }

  private createTargets(max: number): number[] {
    const seeds = max === 10 ? [0, 1, 5, 9, 10] : max === 20 ? [0, 5, 10, 15, 20] : [0, 7, 30, 45, 68, 100];
    const values = new Set<number>(seeds.filter((value) => value <= max));
    while (values.size < QUESTION_COUNT) values.add(Math.floor(Math.random() * (max + 1)));
    return this.shuffle(Array.from(values)).slice(0, QUESTION_COUNT);
  }

  private createChoices(answer: number, max: number): number[] {
    const values = new Set<number>([answer]);
    const offsets = this.shuffle([1, -1, 5, -5, 10, -10, 2, -2]);
    offsets.forEach((offset) => {
      const value = answer + offset;
      if (value >= 0 && value <= max && values.size < 3) values.add(value);
    });
    while (values.size < 3) values.add(Math.floor(Math.random() * (max + 1)));
    return this.shuffle(Array.from(values));
  }

  private hasLongRun(kinds: QuestionKind[]): boolean {
    let run = 1;
    for (let index = 1; index < kinds.length; index += 1) {
      if (kinds[index] === kinds[index - 1]) run += 1;
      else run = 1;
      if (run >= 4) return true;
    }
    return false;
  }

  private levelMax(level: AbacusLevel): number {
    if (level === "to10") return 10;
    if (level === "to20") return 20;
    return 100;
  }

  private levelLabel(level: AbacusLevel | null): string {
    if (level === "to10") return "10まで";
    if (level === "to20") return "20まで";
    if (level === "to100") return "100まで";
    return "じゆう";
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = result[index];
      const swap = result[swapIndex];
      if (current === undefined || swap === undefined) continue;
      result[index] = swap;
      result[swapIndex] = current;
    }
    return result;
  }

  private saveHistory(record: Omit<AbacusHistoryRecord, "id" | "completedAt">): void {
    const history = this.loadHistory();
    history.unshift({ ...record, id: Date.now(), completedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  private loadHistory(): AbacusHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is AbacusHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<AbacusHistoryRecord>;
        const levelValid = row.level === null || row.level === "to10" || row.level === "to20" || row.level === "to100";
        return (
          typeof row.id === "number" &&
          typeof row.completedAt === "string" &&
          (row.mode === "problem" || row.mode === "free") &&
          levelValid &&
          (row.independentCount === null || typeof row.independentCount === "number") &&
          (row.assistedCount === null || typeof row.assistedCount === "number") &&
          (row.totalQuestions === null || typeof row.totalQuestions === "number") &&
          typeof row.durationSeconds === "number" &&
          typeof row.operationCount === "number" &&
          typeof row.finalValue === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private showHistory(): void {
    const history = this.loadHistory();
    const list = this.node<HTMLElement>("history-list");
    if (history.length === 0) {
      list.innerHTML = '<p class="hundred-abacus-empty">まだ きろくが ないよ</p>';
    } else {
      list.innerHTML = history
        .map((row) => {
          const date = new Date(row.completedAt);
          const dateLabel = Number.isNaN(date.getTime())
            ? row.completedAt
            : `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
          const detail = row.mode === "problem"
            ? `ひとり ${row.independentCount ?? 0} / ヒント ${row.assistedCount ?? 0}`
            : `${row.operationCount}かい・さいご ${row.finalValue}`;
          return `<article class="hundred-abacus-history-item"><div><strong>${row.mode === "problem" ? "🎯 もんだい" : "👐 じゆう"}</strong><span>${dateLabel}</span></div><p>${this.levelLabel(row.level)}</p><b>${detail}</b></article>`;
        })
        .join("");
    }
    this.showScreen("history");
  }

  private showScreen(screen: AbacusScreen): void {
    this.state.screen = screen;
    this.root.querySelectorAll<HTMLElement>("[data-role$='-screen']").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.role === `${screen}-screen`);
    });
  }

  private stopSession(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearPendingTimers();
    this.dragging = false;
  }

  private clearPendingTimers(): void {
    if (this.nextTimerId !== null) {
      window.clearTimeout(this.nextTimerId);
      this.nextTimerId = null;
    }
    if (this.matchTimerId !== null) {
      window.clearTimeout(this.matchTimerId);
      this.matchTimerId = null;
    }
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing hundred-abacus node: ${role}`);
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

function initHundredAbacus(): void {
  const game = new HundredAbacusGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHundredAbacus, { once: true });
} else {
  initHundredAbacus();
}
