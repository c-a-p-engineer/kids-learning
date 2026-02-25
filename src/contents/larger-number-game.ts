type LargerLevel = "easy" | "normal" | "hard";
type ActiveScreen = "start" | "game" | "scores" | "result";

interface ScoreRecord {
  id: number;
  date: string;
  level: LargerLevel;
  levelLabel: string;
  score: number;
  corrects: number;
  total: number;
}

interface GameState {
  score: number;
  corrects: number;
  totalAnswered: number;
  combo: number;
  timeLeftMs: number;
  lastTimestamp: number;
  currentLevel: LargerLevel;
  options: number[];
  isLocked: boolean;
  activeScreen: ActiveScreen;
}

const STORAGE_KEY = "math_game_v8_history";
const GAME_TIME_MS = 30_000;
const MAX_HISTORY = 50;

export class LargerNumberGame {
  private readonly root: HTMLElement;
  private readonly state: GameState = {
    score: 0,
    corrects: 0,
    totalAnswered: 0,
    combo: 0,
    timeLeftMs: GAME_TIME_MS,
    lastTimestamp: 0,
    currentLevel: "easy",
    options: [],
    isLocked: false,
    activeScreen: "start",
  };
  private rafId: number | null = null;
  private nextProblemTimerId: number | null = null;
  private comboTimerId: number | null = null;
  private audioContext: AudioContext | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    this.bindEvents();
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.showScreen("start");
    this.updateHeaderScore(0);
    this.updateTimerText(GAME_TIME_MS);
    this.updateTimerBar(GAME_TIME_MS);
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.stopLoop();
    this.clearTimers();
  }

  private template(): string {
    return `
      <div class="larger-number-game">
        <section class="larger-screen active" data-role="start-screen">
          <div class="larger-start-icon">🍎</div>
          <h2 class="larger-start-title">どっちが<br>おおきい？</h2>
          <div class="larger-start-actions">
            <button type="button" class="larger-level-btn larger-level-btn--easy" data-role="btn-start-easy">
              やさしい (10まで)
            </button>
            <button type="button" class="larger-level-btn larger-level-btn--normal" data-role="btn-start-normal">
              ふつう (20まで)
            </button>
            <button type="button" class="larger-level-btn larger-level-btn--hard" data-role="btn-start-hard">
              むずかしい (100まで / 3たく)
            </button>
            <button type="button" class="larger-sub-btn" data-role="btn-open-scores">📊 きろくをみる</button>
          </div>
        </section>

        <section class="larger-screen" data-role="game-screen">
          <div class="larger-head">
            <div class="larger-head-score">スコア: <span data-role="current-score">0</span></div>
            <div class="larger-timer-track">
              <div class="larger-timer-fill" data-role="timer-bar"></div>
            </div>
            <div class="larger-timer-text" data-role="timer-text">30.00</div>
          </div>

          <div class="larger-cards" data-role="cards-container"></div>
          <div class="larger-feedback larger-feedback--correct hidden" data-role="feedback-correct">💮</div>
          <div class="larger-feedback larger-feedback--wrong hidden" data-role="feedback-wrong">✖</div>
          <div class="larger-combo-wrap" data-role="combo-container"></div>
        </section>

        <section class="larger-screen" data-role="scores-screen">
          <h3 class="larger-scores-title">🏆 これまでの きろく</h3>
          <div class="larger-score-list" data-role="score-list-container"></div>
          <div class="larger-scores-actions">
            <button type="button" class="larger-gray-btn" data-role="btn-back-title-from-scores">もどる</button>
            <button type="button" class="larger-danger-btn" data-role="btn-clear-scores">けす</button>
          </div>
        </section>

        <section class="larger-screen" data-role="result-screen">
          <div class="larger-result-icon">🏁</div>
          <h3 class="larger-result-title">タイムアップ！</h3>
          <div class="larger-result-card">
            <div class="larger-result-score" data-role="final-score">0</div>
            <div class="larger-result-unit">てん</div>
            <div class="larger-result-stats" data-role="final-stats"></div>
          </div>
          <button type="button" class="larger-primary-btn" data-role="btn-back-title-from-result">タイトルへ</button>
        </section>
      </div>
    `;
  }

  private bindEvents(): void {
    this.getNode<HTMLButtonElement>("btn-start-easy").addEventListener("click", () => this.startGame("easy"));
    this.getNode<HTMLButtonElement>("btn-start-normal").addEventListener("click", () => this.startGame("normal"));
    this.getNode<HTMLButtonElement>("btn-start-hard").addEventListener("click", () => this.startGame("hard"));
    this.getNode<HTMLButtonElement>("btn-open-scores").addEventListener("click", () => {
      this.showScreen("scores");
    });
    this.getNode<HTMLButtonElement>("btn-back-title-from-scores").addEventListener("click", () => this.backToTitle());
    this.getNode<HTMLButtonElement>("btn-back-title-from-result").addEventListener("click", () => this.backToTitle());
    this.getNode<HTMLButtonElement>("btn-clear-scores").addEventListener("click", () => this.clearScores());
  }

  private getNode<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing larger-number node: ${role}`);
    }
    return element as T;
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private playBeep(type: "correct" | "wrong"): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "correct") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  private startGame(level: LargerLevel): void {
    const ctx = this.getAudioContext();
    if (ctx?.state === "suspended") {
      void ctx.resume();
    }

    this.stopLoop();
    this.clearTimers();

    this.state.currentLevel = level;
    this.state.score = 0;
    this.state.corrects = 0;
    this.state.totalAnswered = 0;
    this.state.combo = 0;
    this.state.timeLeftMs = GAME_TIME_MS;
    this.state.isLocked = false;

    this.updateHeaderScore(this.state.score);
    this.updateTimerText(this.state.timeLeftMs);
    this.updateTimerBar(this.state.timeLeftMs);
    this.getNode<HTMLElement>("timer-text").classList.remove("timer-warning");

    this.showScreen("game");
    this.nextProblem();

    this.state.lastTimestamp = performance.now();
    this.rafId = window.requestAnimationFrame((now) => this.gameLoop(now));
  }

  private gameLoop(now: number): void {
    if (this.state.activeScreen !== "game") return;

    const delta = now - this.state.lastTimestamp;
    this.state.lastTimestamp = now;
    this.state.timeLeftMs -= delta;

    if (this.state.timeLeftMs <= 0) {
      this.state.timeLeftMs = 0;
      this.updateTimerText(this.state.timeLeftMs);
      this.updateTimerBar(this.state.timeLeftMs);
      this.endGame();
      return;
    }

    this.updateTimerText(this.state.timeLeftMs);
    this.updateTimerBar(this.state.timeLeftMs);
    if (this.state.timeLeftMs < 5000) {
      this.getNode<HTMLElement>("timer-text").classList.add("timer-warning");
    }

    this.rafId = window.requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  private nextProblem(): void {
    const range = this.state.currentLevel === "easy" ? 10 : this.state.currentLevel === "normal" ? 20 : 100;
    const choiceCount = this.state.currentLevel === "hard" ? 3 : 2;
    const options: number[] = [];
    while (options.length < choiceCount) {
      const value = Math.floor(Math.random() * range) + 1;
      if (!options.includes(value)) options.push(value);
    }
    this.state.options = options;
    this.state.isLocked = false;
    this.renderCards();
  }

  private renderCards(): void {
    const container = this.getNode<HTMLElement>("cards-container");
    container.innerHTML = "";
    const isHard = this.state.currentLevel === "hard";

    this.state.options.forEach((value, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `larger-choice-card ${isHard ? "larger-choice-card--hard" : ""}`;
      card.addEventListener("click", () => this.handleChoice(idx));

      const top = document.createElement("div");
      top.className = "larger-choice-number";
      top.textContent = String(value);
      card.appendChild(top);

      if (!isHard) {
        const apples = document.createElement("div");
        apples.className = "larger-apple-wrap";
        this.renderApples(apples, value);
        card.appendChild(apples);
      }

      container.appendChild(card);
    });
  }

  private renderApples(container: HTMLElement, count: number): void {
    const boxesNeeded = Math.ceil(count / 10);
    for (let boxIndex = 0; boxIndex < boxesNeeded; boxIndex += 1) {
      const box = document.createElement("div");
      box.className = "larger-apple-box";
      const applesInThisBox = Math.min(10, count - boxIndex * 10);
      for (let i = 0; i < applesInThisBox; i += 1) {
        const apple = document.createElement("span");
        apple.className = "larger-apple-emoji";
        apple.textContent = "🍎";
        box.appendChild(apple);
      }
      container.appendChild(box);
    }
  }

  private handleChoice(index: number): void {
    if (this.state.isLocked || this.state.timeLeftMs <= 0) return;
    this.state.isLocked = true;
    this.state.totalAnswered += 1;

    const maxVal = Math.max(...this.state.options);
    if (this.state.options[index] === maxVal) {
      this.playBeep("correct");
      this.state.combo += 1;
      let bonus = this.state.currentLevel === "easy" ? 10 : this.state.currentLevel === "normal" ? 20 : 50;
      if (this.state.combo >= 2) {
        bonus += this.state.combo * 5;
        this.showCombo(this.state.combo);
      }
      this.state.score += bonus;
      this.state.corrects += 1;
      this.updateHeaderScore(this.state.score);
      this.showFeedback("correct");
      this.nextProblemTimerId = window.setTimeout(() => this.nextProblem(), 300);
      return;
    }

    this.playBeep("wrong");
    this.state.combo = 0;
    const screen = this.getNode<HTMLElement>("game-screen");
    screen.classList.add("shake");
    this.showFeedback("wrong");
    this.nextProblemTimerId = window.setTimeout(() => {
      screen.classList.remove("shake");
      this.nextProblem();
    }, 400);
  }

  private showCombo(combo: number): void {
    const wrap = this.getNode<HTMLElement>("combo-container");
    const item = document.createElement("div");
    item.className = "larger-combo";
    item.textContent = `${combo}コンボ！`;
    wrap.appendChild(item);
    this.comboTimerId = window.setTimeout(() => {
      item.remove();
    }, 600);
  }

  private showFeedback(type: "correct" | "wrong"): void {
    const element = this.getNode<HTMLElement>(`feedback-${type}`);
    element.classList.remove("hidden");
    element.classList.remove("animate-feedback");
    void element.offsetWidth;
    element.classList.add("animate-feedback");
    window.setTimeout(() => {
      element.classList.add("hidden");
      element.classList.remove("animate-feedback");
    }, 500);
  }

  private endGame(): void {
    this.stopLoop();
    this.clearTimers();
    this.getNode<HTMLElement>("final-score").textContent = String(this.state.score);
    this.getNode<HTMLElement>("final-stats").textContent = `${this.getLevelName(this.state.currentLevel)} ・ せいかい ${
      this.state.corrects
    }回`;
    this.saveScore();
    this.showScreen("result");
  }

  private getLevelName(level: LargerLevel): string {
    if (level === "easy") return "やさしい";
    if (level === "normal") return "ふつう";
    return "むずかしい";
  }

  private loadScores(): ScoreRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is ScoreRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<ScoreRecord>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          (row.level === "easy" || row.level === "normal" || row.level === "hard") &&
          typeof row.levelLabel === "string" &&
          typeof row.score === "number" &&
          typeof row.corrects === "number" &&
          typeof row.total === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private saveScore(): void {
    const history = this.loadScores();
    const now = new Date();
    const record: ScoreRecord = {
      id: Date.now(),
      date: `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      level: this.state.currentLevel,
      levelLabel: this.getLevelName(this.state.currentLevel),
      score: this.state.score,
      corrects: this.state.corrects,
      total: this.state.totalAnswered,
    };
    history.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  private renderScoreList(): void {
    const history = this.loadScores();
    const container = this.getNode<HTMLElement>("score-list-container");
    if (history.length === 0) {
      container.innerHTML = '<div class="larger-score-empty">まだ きろくが ないよ</div>';
      return;
    }

    container.innerHTML = history
      .map((row) => {
        return `
          <article class="larger-score-item larger-score-item--${row.level}">
            <div class="larger-score-head">
              <span class="larger-score-date">${row.date}</span>
              <span class="larger-score-level larger-score-level--${row.level}">${row.levelLabel}</span>
            </div>
            <div class="larger-score-foot">
              <div class="larger-score-correct"><span>${row.corrects}</span> / ${row.total} せいかい</div>
              <div class="larger-score-point">${row.score}<small>てん</small></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  private clearScores(): void {
    const ok = window.confirm("ぜんぶの きろくを けしても いい？");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    this.renderScoreList();
  }

  private showScreen(screen: ActiveScreen): void {
    this.state.activeScreen = screen;
    this.getNode<HTMLElement>("start-screen").classList.toggle("active", screen === "start");
    this.getNode<HTMLElement>("game-screen").classList.toggle("active", screen === "game");
    this.getNode<HTMLElement>("scores-screen").classList.toggle("active", screen === "scores");
    this.getNode<HTMLElement>("result-screen").classList.toggle("active", screen === "result");

    if (screen === "scores") {
      this.renderScoreList();
    }
  }

  private backToTitle(): void {
    this.stopLoop();
    this.clearTimers();
    this.showScreen("start");
  }

  private updateHeaderScore(score: number): void {
    this.getNode<HTMLElement>("current-score").textContent = String(score);
  }

  private updateTimerText(timeLeftMs: number): void {
    this.getNode<HTMLElement>("timer-text").textContent = (timeLeftMs / 1000).toFixed(2);
  }

  private updateTimerBar(timeLeftMs: number): void {
    const width = Math.max(0, (timeLeftMs / GAME_TIME_MS) * 100);
    this.getNode<HTMLElement>("timer-bar").style.width = `${width}%`;
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private clearTimers(): void {
    if (this.nextProblemTimerId !== null) {
      window.clearTimeout(this.nextProblemTimerId);
      this.nextProblemTimerId = null;
    }
    if (this.comboTimerId !== null) {
      window.clearTimeout(this.comboTimerId);
      this.comboTimerId = null;
    }
  }
}
