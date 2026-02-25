import { audioService } from "../app/audio";

type LevelId = 1 | 2 | 3;

interface EmojiEntry {
  char: string;
  kana: string;
}

interface LevelConfig {
  name: string;
  count: number;
  speed: number;
  quizCount: number;
  ttsRate: number;
}

interface FlashcardHistoryEntry {
  id: number;
  date: string;
  levelName: string;
  score: string;
  accuracy: number;
  emojiList: string;
}

interface FlashcardState {
  currentRun: EmojiEntry[];
  availableForQuiz: EmojiEntry[];
  currentIndex: number;
  config: LevelConfig | null;
  quizStep: number;
  correctCount: number;
  history: FlashcardHistoryEntry[];
}

const STORAGE_KEY = "emoji_v10_history";

const EMOJIS: EmojiEntry[] = [
  { char: "🐶", kana: "いぬ" },
  { char: "🐱", kana: "ねこ" },
  { char: "🐭", kana: "ねずみ" },
  { char: "🐰", kana: "うさぎ" },
  { char: "🦊", kana: "きつね" },
  { char: "🐻", kana: "くま" },
  { char: "🐼", kana: "ぱんだ" },
  { char: "🐯", kana: "とら" },
  { char: "🦁", kana: "らいおん" },
  { char: "🍎", kana: "りんご" },
  { char: "🍊", kana: "みかん" },
  { char: "🍋", kana: "れもん" },
  { char: "🍌", kana: "ばなな" },
  { char: "🍉", kana: "すいか" },
  { char: "🍇", kana: "ぶどう" },
  { char: "🚗", kana: "くるま" },
  { char: "🚒", kana: "しょうぼうしゃ" },
  { char: "🚑", kana: "きゅうきゅうしゃ" },
  { char: "🚓", kana: "ぱとかー" },
  { char: "🚁", kana: "へりこぷたー" },
  { char: "🚂", kana: "きかんしゃ" },
  { char: "🚀", kana: "ろけっと" },
  { char: "🎂", kana: "けーき" },
  { char: "🌈", kana: "にじ" },
  { char: "🍦", kana: "あいす" },
  { char: "🍟", kana: "ぽてと" },
  { char: "⚽", kana: "さっかー" },
];

const LEVELS: Record<LevelId, LevelConfig> = {
  1: { name: "やさしい", count: 5, speed: 1100, quizCount: 2, ttsRate: 1.2 },
  2: { name: "ふつう", count: 10, speed: 750, quizCount: 3, ttsRate: 1.5 },
  3: { name: "むずかしい", count: 15, speed: 450, quizCount: 4, ttsRate: 2.2 },
};

export class FlashcardGame {
  private readonly root: HTMLElement;
  private state: FlashcardState;
  private cardTimerId: number | null = null;
  private feedbackTimerId: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = {
      currentRun: [],
      availableForQuiz: [],
      currentIndex: 0,
      config: null,
      quizStep: 0,
      correctCount: 0,
      history: this.loadHistory(),
    };
    this.root.innerHTML = this.template();
    this.bindEvents();
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.showView("idle");
    this.getNode<HTMLElement>("progress").textContent = "0/0";
  }

  hide(): void {
    this.clearTimers();
    this.stopSpeech();
    this.toggleHistoryOverlay(false);
    this.root.classList.add("hidden");
  }

  private template(): string {
    return `
      <div class="flashcard-game">
        <header class="flashcard-header">
          <div class="flashcard-brand">
            <span class="flashcard-brand-icon">🏅</span>
            <h3 class="flashcard-brand-title">えもじフラッシュ</h3>
          </div>
          <div class="flashcard-header-right">
            <button type="button" class="flashcard-history-btn" data-role="btn-history">きろく</button>
            <div class="flashcard-progress" data-role="progress">0/0</div>
          </div>
        </header>

        <main class="flashcard-main">
          <section class="flashcard-view" data-role="view-idle">
            <h2 class="flashcard-idle-title">レベルをえらぼう！</h2>
            <div class="flashcard-level-list">
              <button type="button" class="flashcard-level-btn flashcard-level-btn--easy" data-role="start-1">
                <span class="flashcard-level-label">🟢 やさしい</span>
                <span class="flashcard-level-meta">5枚 / クイズ2問</span>
              </button>
              <button type="button" class="flashcard-level-btn flashcard-level-btn--normal" data-role="start-2">
                <span class="flashcard-level-label">🟠 ふつう</span>
                <span class="flashcard-level-meta">10枚 / クイズ3問</span>
              </button>
              <button type="button" class="flashcard-level-btn flashcard-level-btn--hard" data-role="start-3">
                <span class="flashcard-level-label">🔴 むずかしい</span>
                <span class="flashcard-level-meta">15枚 / クイズ4問</span>
              </button>
            </div>
          </section>

          <section class="flashcard-view hidden" data-role="view-game">
            <div class="flashcard-card">
              <div class="flashcard-emoji" data-role="emoji"></div>
              <div class="flashcard-kana" data-role="kana"></div>
            </div>
          </section>

          <section class="flashcard-view hidden" data-role="view-quiz">
            <div class="flashcard-quiz-head">
              <p class="flashcard-quiz-step" data-role="quiz-step-info">Question 1/2</p>
              <h2 class="flashcard-quiz-title">これはあったかな？</h2>
            </div>
            <div class="flashcard-choices">
              <button type="button" class="flashcard-choice-btn" data-role="choice-0">
                <span class="flashcard-choice-emoji"></span>
                <span class="flashcard-choice-kana"></span>
              </button>
              <button type="button" class="flashcard-choice-btn" data-role="choice-1">
                <span class="flashcard-choice-emoji"></span>
                <span class="flashcard-choice-kana"></span>
              </button>
            </div>
          </section>

          <section class="flashcard-view hidden" data-role="view-result">
            <div class="flashcard-result-card">
              <h2 class="flashcard-result-title">スコアは...</h2>
              <div class="flashcard-result-score" data-role="result-score">0/0</div>
              <div class="flashcard-result-message" data-role="result-message">よくがんばったね！</div>
              <button type="button" class="flashcard-primary-btn" data-role="btn-back-title">タイトルにもどる</button>
            </div>
          </section>
        </main>

        <div class="flashcard-feedback hidden" data-role="feedback">
          <div class="flashcard-feedback-icon" data-role="feedback-icon">○</div>
        </div>

        <div class="flashcard-history-overlay hidden" data-role="history-overlay">
          <div class="flashcard-history-panel">
            <div class="flashcard-history-head">
              <h3 class="flashcard-history-title">これまでのきろく</h3>
              <button type="button" class="flashcard-history-close" data-role="btn-close-history">×</button>
            </div>
            <div class="flashcard-history-list" data-role="history-list"></div>
            <div class="flashcard-history-foot">
              <button type="button" class="flashcard-clear-btn" data-role="btn-clear-history">履歴をクリア</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.getNode<HTMLButtonElement>("start-1").addEventListener("click", () => this.startGame(1));
    this.getNode<HTMLButtonElement>("start-2").addEventListener("click", () => this.startGame(2));
    this.getNode<HTMLButtonElement>("start-3").addEventListener("click", () => this.startGame(3));
    this.getNode<HTMLButtonElement>("btn-back-title").addEventListener("click", () => this.backToTitle());
    this.getNode<HTMLButtonElement>("btn-history").addEventListener("click", () => {
      this.renderHistory();
      this.toggleHistoryOverlay(true);
    });
    this.getNode<HTMLButtonElement>("btn-close-history").addEventListener("click", () => {
      this.toggleHistoryOverlay(false);
    });
    this.getNode<HTMLButtonElement>("btn-clear-history").addEventListener("click", () => {
      this.clearHistory();
    });

    this.getNode<HTMLElement>("history-overlay").addEventListener("click", (event) => {
      if (event.target === this.getNode<HTMLElement>("history-overlay")) {
        this.toggleHistoryOverlay(false);
      }
    });
  }

  private getNode<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing flashcard node: ${role}`);
    }
    return element as T;
  }

  private loadHistory(): FlashcardHistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is FlashcardHistoryEntry => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<FlashcardHistoryEntry>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          typeof row.levelName === "string" &&
          typeof row.score === "string" &&
          typeof row.accuracy === "number" &&
          typeof row.emojiList === "string"
        );
      });
    } catch {
      return [];
    }
  }

  private saveHistory(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.history.slice(0, 50)));
  }

  private shuffle<T>(source: T[]): T[] {
    const arr = [...source];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private startGame(levelId: LevelId): void {
    const config = LEVELS[levelId];
    const run = this.shuffle(EMOJIS).slice(0, config.count);
    this.state.currentRun = run;
    this.state.availableForQuiz = [...run];
    this.state.currentIndex = 0;
    this.state.quizStep = 0;
    this.state.correctCount = 0;
    this.state.config = config;

    this.clearTimers();
    this.stopSpeech();
    this.showView("game");
    this.showNextCard();
  }

  private showNextCard(): void {
    const config = this.state.config;
    if (!config) return;

    if (this.state.currentIndex >= this.state.currentRun.length) {
      this.cardTimerId = window.setTimeout(() => {
        this.startQuizMode();
      }, 400);
      return;
    }

    const item = this.state.currentRun[this.state.currentIndex];
    this.getNode<HTMLElement>("emoji").textContent = item.char;
    this.getNode<HTMLElement>("kana").textContent = item.kana;
    this.getNode<HTMLElement>("progress").textContent = `${this.state.currentIndex + 1}/${this.state.currentRun.length}`;
    this.speakKana(item.kana, config.ttsRate);

    this.cardTimerId = window.setTimeout(() => {
      this.state.currentIndex += 1;
      this.showNextCard();
    }, config.speed);
  }

  private startQuizMode(): void {
    this.showView("quiz");
    this.nextQuizStep();
  }

  private nextQuizStep(): void {
    const config = this.state.config;
    if (!config) return;

    if (this.state.quizStep >= config.quizCount) {
      this.showResult();
      return;
    }

    this.getNode<HTMLElement>("quiz-step-info").textContent = `Question ${this.state.quizStep + 1}/${config.quizCount}`;
    const poolIndex = Math.floor(Math.random() * this.state.availableForQuiz.length);
    const correct = this.state.availableForQuiz.splice(poolIndex, 1)[0];
    if (!correct) {
      this.showResult();
      return;
    }

    let wrong: EmojiEntry | null = null;
    for (let i = 0; i < 20; i += 1) {
      const candidate = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      if (!this.state.currentRun.some((entry) => entry.char === candidate.char)) {
        wrong = candidate;
        break;
      }
    }
    if (!wrong) {
      wrong = EMOJIS.find((entry) => entry.char !== correct.char) ?? correct;
    }

    const choices = this.shuffle([correct, wrong]);
    choices.forEach((choice, idx) => {
      const button = this.getNode<HTMLButtonElement>(`choice-${idx}`);
      const emoji = button.querySelector(".flashcard-choice-emoji");
      const kana = button.querySelector(".flashcard-choice-kana");
      if (!(emoji instanceof HTMLElement) || !(kana instanceof HTMLElement)) return;
      emoji.textContent = choice.char;
      kana.textContent = choice.kana;
      button.onclick = () => {
        this.handleQuizAnswer(choice.char === correct.char);
      };
    });
  }

  private handleQuizAnswer(isCorrect: boolean): void {
    if (isCorrect) {
      this.state.correctCount += 1;
      this.playSE("ok");
      this.showFeedback("○", "flashcard-feedback-icon flashcard-feedback-icon--ok");
    } else {
      this.playSE("ng");
      this.showFeedback("×", "flashcard-feedback-icon flashcard-feedback-icon--ng");
    }

    this.feedbackTimerId = window.setTimeout(() => {
      this.hideFeedback();
      this.state.quizStep += 1;
      this.nextQuizStep();
    }, 700);
  }

  private showFeedback(text: string, className: string): void {
    const feedback = this.getNode<HTMLElement>("feedback");
    const icon = this.getNode<HTMLElement>("feedback-icon");
    icon.textContent = text;
    icon.className = className;
    feedback.classList.remove("hidden");
  }

  private hideFeedback(): void {
    this.getNode<HTMLElement>("feedback").classList.add("hidden");
  }

  private showResult(): void {
    const config = this.state.config;
    if (!config) return;

    this.showView("result");
    const score = this.state.correctCount;
    const total = config.quizCount;
    this.getNode<HTMLElement>("result-score").textContent = `${score}/${total}`;

    const message = this.getNode<HTMLElement>("result-message");
    if (score === total) {
      message.textContent = "💯 はなまる！ かんぺきだね！";
      message.className = "flashcard-result-message flashcard-result-message--best";
    } else if (score >= total / 2) {
      message.textContent = "✨ おしい！ あとすこしだね！";
      message.className = "flashcard-result-message flashcard-result-message--good";
    } else {
      message.textContent = "🌈 またこんどがんばろう！";
      message.className = "flashcard-result-message flashcard-result-message--retry";
    }

    this.saveToHistory();
  }

  private backToTitle(): void {
    this.showView("idle");
    this.getNode<HTMLElement>("progress").textContent = "0/0";
  }

  private saveToHistory(): void {
    const config = this.state.config;
    if (!config) return;

    const accuracy = Math.round((this.state.correctCount / config.quizCount) * 100);
    const now = new Date();
    const date = `${now.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })} ${now.toLocaleTimeString(
      "ja-JP",
      { hour: "2-digit", minute: "2-digit" },
    )}`;

    this.state.history.unshift({
      id: Date.now(),
      date,
      levelName: config.name,
      score: `${this.state.correctCount}/${config.quizCount}`,
      accuracy,
      emojiList: this.state.currentRun.map((entry) => entry.char).join(""),
    });
    this.saveHistory();
  }

  private renderHistory(): void {
    const list = this.getNode<HTMLElement>("history-list");
    if (this.state.history.length === 0) {
      list.innerHTML = '<div class="flashcard-history-empty">きろくなし</div>';
      return;
    }

    list.innerHTML = this.state.history
      .map((row) => {
        const accuracyClass =
          row.accuracy === 100
            ? "flashcard-history-acc flashcard-history-acc--best"
            : row.accuracy >= 50
              ? "flashcard-history-acc flashcard-history-acc--good"
              : "flashcard-history-acc flashcard-history-acc--retry";

        return `
          <article class="flashcard-history-item">
            <div class="flashcard-history-row">
              <div class="flashcard-history-meta">
                <span class="flashcard-history-date">${row.date}</span>
                <span class="flashcard-history-level">${row.levelName}</span>
              </div>
              <div class="flashcard-history-score-wrap">
                <div class="${accuracyClass}">${row.accuracy}%</div>
                <div class="flashcard-history-score">${row.score} 正解</div>
              </div>
            </div>
            <div class="flashcard-history-emojis">${row.emojiList}</div>
          </article>
        `;
      })
      .join("");
  }

  private clearHistory(): void {
    this.state.history = [];
    localStorage.removeItem(STORAGE_KEY);
    this.renderHistory();
  }

  private toggleHistoryOverlay(show: boolean): void {
    this.getNode<HTMLElement>("history-overlay").classList.toggle("hidden", !show);
  }

  private showView(view: "idle" | "game" | "quiz" | "result"): void {
    this.getNode<HTMLElement>("view-idle").classList.toggle("hidden", view !== "idle");
    this.getNode<HTMLElement>("view-game").classList.toggle("hidden", view !== "game");
    this.getNode<HTMLElement>("view-quiz").classList.toggle("hidden", view !== "quiz");
    this.getNode<HTMLElement>("view-result").classList.toggle("hidden", view !== "result");
  }

  private stopSpeech(): void {
    audioService.stopSpeech();
  }

  private speakKana(text: string, rate: number): void {
    audioService.speak(text, { lang: "ja-JP", rate });
  }

  private playSE(type: "ok" | "ng"): void {
    if (type === "ok") {
      audioService.playTone({
        frequency: 523,
        type: "sine",
        gain: 0.1,
        durationMs: 500,
        sweepToFrequency: 880,
      });
    } else {
      audioService.playTone({
        frequency: 140,
        type: "sawtooth",
        gain: 0.1,
        durationMs: 500,
      });
    }
  }

  private clearTimers(): void {
    if (this.cardTimerId !== null) {
      window.clearTimeout(this.cardTimerId);
      this.cardTimerId = null;
    }
    if (this.feedbackTimerId !== null) {
      window.clearTimeout(this.feedbackTimerId);
      this.feedbackTimerId = null;
    }
  }
}
