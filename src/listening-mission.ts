import { audioService } from "./app/audio";
import "./styles/listening-mission.scss";

type ListeningLevel = "one" | "two";
type ListeningScreen = "start" | "game" | "history" | "result";

interface ListeningItem {
  emoji: string;
  name: string;
}

interface ListeningRound {
  targets: ListeningItem[];
  choices: ListeningItem[];
}

interface ListeningHistoryRecord {
  id: number;
  date: string;
  level: ListeningLevel;
  levelLabel: string;
  missions: number;
  firstTry: number;
  replays: number;
  earlyTaps: number;
  offTargetTaps: number;
  recovered: number;
}

interface ListeningSessionStats {
  firstTry: number;
  replays: number;
  earlyTaps: number;
  offTargetTaps: number;
  recovered: number;
}

const CONTENT_ID = "listening-mission";
const STORAGE_KEY = "listening_mission_v1_history";
const SESSION_MISSIONS = 5;
const MAX_HISTORY = 40;

const ITEMS: ListeningItem[] = [
  { emoji: "🍎", name: "りんご" },
  { emoji: "🍌", name: "ばなな" },
  { emoji: "🍇", name: "ぶどう" },
  { emoji: "🐶", name: "いぬ" },
  { emoji: "🐱", name: "ねこ" },
  { emoji: "🐰", name: "うさぎ" },
  { emoji: "🚗", name: "くるま" },
  { emoji: "🚃", name: "でんしゃ" },
  { emoji: "✈️", name: "ひこうき" },
  { emoji: "⭐", name: "ほし" },
  { emoji: "☀️", name: "たいよう" },
  { emoji: "☂️", name: "かさ" },
];

class ListeningMissionGame {
  private readonly root: HTMLElement;
  private readonly portalPath: string;
  private screen: ListeningScreen = "start";
  private level: ListeningLevel = "one";
  private roundIndex = 0;
  private targetIndex = 0;
  private round: ListeningRound | null = null;
  private speaking = false;
  private roundHadDetour = false;
  private roundUsedReplay = false;
  private locked = false;
  private nextTimerId: number | null = null;
  private speechTimerId: number | null = null;
  private speechToken = 0;
  private stats: ListeningSessionStats = this.emptyStats();

  constructor() {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Missing main content root");

    this.portalPath = this.resolvePortalPath();
    this.root = document.createElement("section");
    this.root.id = "listening-mission-experience";
    this.root.className = "listening-mission-experience hidden";
    this.root.setAttribute("aria-label", "きいてミッション");
    this.root.innerHTML = this.template();
    main.appendChild(this.root);
    this.bindEvents();
  }

  init(): void {
    this.decoratePortalCard();
    this.bindPortalCard();
    window.addEventListener("popstate", () => {
      window.requestAnimationFrame(() => this.syncFromLocation());
    });
    this.syncFromLocation();
  }

  private template(): string {
    return `
      <div class="listening-mission-shell">
        <header class="listening-mission-header">
          <div>
            <p class="listening-mission-step">STEP 1</p>
            <h2>👂 きいて！ミッション</h2>
          </div>
          <button type="button" class="listening-mission-back" data-role="back-portal" aria-label="学びの一覧にもどる">
            🏠 いちらん
          </button>
        </header>

        <section class="listening-mission-screen is-active" data-role="start-screen">
          <div class="listening-mission-hero" aria-hidden="true">👂 → 🧠 → 👆</div>
          <h3>おはなしを さいごまで きこう</h3>
          <p class="listening-mission-lead">きこえたものを、じゅんばんに タッチ！</p>
          <p class="listening-mission-session-note">🏁 5ミッションで おしまい</p>
          <div class="listening-mission-levels">
            <button type="button" data-role="start-one">
              <span class="listening-mission-level-icon" aria-hidden="true">🐣</span>
              <strong>やさしい</strong>
              <small>「りんごを タッチ」</small>
            </button>
            <button type="button" data-role="start-two">
              <span class="listening-mission-level-icon" aria-hidden="true">🦁</span>
              <strong>ふつう</strong>
              <small>「いぬ → ほし」の 2こ</small>
            </button>
          </div>
          <button type="button" class="listening-mission-sub" data-role="open-history">📊 おうちのひとの きろく</button>
        </section>

        <section class="listening-mission-screen" data-role="game-screen">
          <div class="listening-mission-progress-row">
            <span>🎯 <strong data-role="mission-progress">1 / 5</strong></span>
            <span data-role="level-label">やさしい</span>
          </div>
          <div class="listening-mission-progress-track" aria-label="ミッションの進み具合">
            <div class="listening-mission-progress-fill" data-role="progress-fill"></div>
          </div>

          <div class="listening-mission-callout" aria-live="polite">
            <div class="listening-mission-ear" aria-hidden="true">👂</div>
            <p class="listening-mission-status" data-role="listen-status">よく きいてね</p>
            <p class="listening-mission-fallback hidden" data-role="fallback-text"></p>
            <button type="button" class="listening-mission-replay" data-role="replay-instruction">🔊 もういちど きく</button>
          </div>

          <div class="listening-mission-step-dots" data-role="step-dots" aria-label="いまの順番"></div>
          <div class="listening-mission-choices" data-role="choices" aria-label="タッチするもの"></div>
          <div class="listening-mission-feedback" data-role="feedback" aria-live="assertive">👂 おはなしを きいてみよう</div>
        </section>

        <section class="listening-mission-screen" data-role="history-screen">
          <div class="listening-mission-history-head">
            <div>
              <p class="listening-mission-parent-label">おうちのひと向け</p>
              <h3>📊 きく力の きろく</h3>
            </div>
            <button type="button" data-role="history-back">↩️ もどる</button>
          </div>
          <p class="listening-mission-history-note">
            点数ではなく「最初の指示でできた」「途中でそれても戻れた」を見るための家庭内記録です。
          </p>
          <div class="listening-mission-history" data-role="history-list"></div>
        </section>

        <section class="listening-mission-screen" data-role="result-screen">
          <div class="listening-mission-finish" aria-hidden="true">💮</div>
          <h3>5ミッション できた！</h3>
          <p class="listening-mission-result-message" data-role="result-message">さいごまで よく きけたね</p>
          <div class="listening-mission-result-stars" aria-hidden="true">⭐ ⭐ ⭐ ⭐ ⭐</div>
          <div class="listening-mission-result-actions">
            <button type="button" class="listening-mission-primary" data-role="play-again">🔁 もういちど</button>
            <button type="button" data-role="result-back">🎮 メニューへ</button>
          </div>
        </section>
      </div>
    `;
  }

  private bindEvents(): void {
    this.node<HTMLButtonElement>("back-portal").addEventListener("click", () => this.closeToPortal());
    this.node<HTMLButtonElement>("start-one").addEventListener("click", () => this.startSession("one"));
    this.node<HTMLButtonElement>("start-two").addEventListener("click", () => this.startSession("two"));
    this.node<HTMLButtonElement>("open-history").addEventListener("click", () => this.showHistory());
    this.node<HTMLButtonElement>("history-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("result-back").addEventListener("click", () => this.showScreen("start"));
    this.node<HTMLButtonElement>("play-again").addEventListener("click", () => this.startSession(this.level));
    this.node<HTMLButtonElement>("replay-instruction").addEventListener("click", () => {
      if (this.speaking || !this.round || this.locked) return;
      this.stats.replays += 1;
      this.roundUsedReplay = true;
      this.speakCurrentInstruction();
    });
  }

  private bindPortalCard(): void {
    const list = document.getElementById("content-list");
    if (!list || list.dataset.listeningMissionBound === "true") return;
    list.dataset.listeningMissionBound = "true";
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
    if (icon) icon.textContent = "👂";
  }

  private open(): void {
    const path = `${this.portalPath.replace(/\/?$/, "/")}${CONTENT_ID}`;
    if (!this.isCurrentPath()) window.history.pushState(null, "", path);
    this.showExperience();
  }

  private closeToPortal(): void {
    this.stopRound();
    window.history.pushState(null, "", this.portalPath);
    this.hideExperience();
    document.getElementById("view-portal")?.classList.remove("hidden");
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
    if (this.screen !== "game") this.showScreen("start");
  }

  private hideExperience(): void {
    this.stopRound();
    this.root.classList.add("hidden");
  }

  private startSession(level: ListeningLevel): void {
    audioService.resume();
    this.stopRound();
    this.level = level;
    this.roundIndex = 0;
    this.targetIndex = 0;
    this.round = null;
    this.stats = this.emptyStats();
    this.showScreen("game");
    this.nextRound();
  }

  private nextRound(): void {
    this.stopRound();
    if (this.roundIndex >= SESSION_MISSIONS) {
      this.finishSession();
      return;
    }

    this.round = this.createRound();
    this.targetIndex = 0;
    this.roundHadDetour = false;
    this.roundUsedReplay = false;
    this.locked = false;
    this.renderRound();
    this.speakCurrentInstruction();
  }

  private createRound(): ListeningRound {
    const shuffled = this.shuffle(ITEMS);
    const targetCount = this.level === "one" ? 1 : 2;
    const targets = shuffled.slice(0, targetCount);
    const choiceCount = this.level === "one" ? 4 : 6;
    const choices = this.shuffle(shuffled.slice(0, choiceCount));
    return { targets, choices };
  }

  private renderRound(): void {
    const round = this.round;
    if (!round) return;

    this.node<HTMLElement>("mission-progress").textContent = `${this.roundIndex + 1} / ${SESSION_MISSIONS}`;
    this.node<HTMLElement>("level-label").textContent = this.levelLabel(this.level);
    this.node<HTMLElement>("progress-fill").style.width = `${((this.roundIndex + 1) / SESSION_MISSIONS) * 100}%`;
    this.node<HTMLElement>("listen-status").textContent = "よく きいてね";
    this.node<HTMLElement>("fallback-text").classList.add("hidden");
    this.node<HTMLElement>("fallback-text").textContent = "";
    this.setFeedback("👂 おはなしを きいてみよう", "neutral");
    this.renderStepDots();

    const choices = this.node<HTMLElement>("choices");
    choices.innerHTML = "";
    round.choices.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "listening-mission-choice";
      button.dataset.itemName = item.name;
      button.setAttribute("aria-label", item.name);
      button.innerHTML = `<span class="listening-mission-choice-emoji" aria-hidden="true">${item.emoji}</span><span>${item.name}</span>`;
      button.addEventListener("click", () => this.handleChoice(item));
      choices.appendChild(button);
    });
  }

  private renderStepDots(): void {
    const round = this.round;
    if (!round) return;
    const dots = this.node<HTMLElement>("step-dots");
    dots.innerHTML = round.targets
      .map((_, index) => {
        const state = index < this.targetIndex ? "is-done" : index === this.targetIndex ? "is-current" : "";
        return `<span class="listening-mission-step-dot ${state}">${index + 1}</span>`;
      })
      .join('<span class="listening-mission-step-arrow" aria-hidden="true">→</span>');
  }

  private handleChoice(item: ListeningItem): void {
    const round = this.round;
    if (!round || this.locked || this.screen !== "game") return;

    if (this.speaking) {
      this.stats.earlyTaps += 1;
      this.roundHadDetour = true;
      this.setFeedback("👂 さいごまで きいてから タッチしよう", "return");
      audioService.playTone({ frequency: 330, type: "sine", gain: 0.05, durationMs: 120 });
      return;
    }

    const target = round.targets[this.targetIndex];
    if (!target) return;

    if (item.name !== target.name) {
      this.stats.offTargetTaps += 1;
      this.roundHadDetour = true;
      this.setFeedback("🔄 ミッションに もどろう。おもいだしてみよう", "return");
      audioService.playTone({ frequency: 300, type: "triangle", gain: 0.05, durationMs: 160 });
      return;
    }

    const selected = this.node<HTMLElement>("choices").querySelector<HTMLButtonElement>(
      `[data-item-name="${item.name}"]`,
    );
    selected?.classList.add("is-selected");
    selected?.setAttribute("aria-pressed", "true");

    this.targetIndex += 1;
    this.renderStepDots();
    audioService.playTone({ frequency: 660, sweepToFrequency: 990, gain: 0.09, durationMs: 180 });

    if (this.targetIndex < round.targets.length) {
      this.setFeedback("💮 1こめ できた！ つぎは どれだったかな？", "success");
      return;
    }

    this.locked = true;
    if (!this.roundHadDetour && !this.roundUsedReplay) this.stats.firstTry += 1;
    if (this.roundHadDetour) this.stats.recovered += 1;
    this.setFeedback(this.roundHadDetour ? "💮 もどれた！ ミッション クリア！" : "💮 ミッション クリア！", "success");
    this.roundIndex += 1;
    this.nextTimerId = window.setTimeout(() => this.nextRound(), 700);
  }

  private speakCurrentInstruction(): void {
    const round = this.round;
    if (!round) return;

    this.stopSpeech();
    const token = ++this.speechToken;
    this.speaking = true;
    this.node<HTMLButtonElement>("replay-instruction").disabled = true;
    this.node<HTMLElement>("listen-status").textContent = "👂 おはなしを きこう";
    this.node<HTMLElement>("fallback-text").classList.add("hidden");

    const text = this.instructionText(round.targets);
    this.speechTimerId = window.setTimeout(() => {
      this.speechTimerId = null;
      if (token !== this.speechToken) return;

      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        this.finishSpeech(token, text);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.78;
      utterance.pitch = 1;
      utterance.onend = () => this.finishSpeech(token, null);
      utterance.onerror = () => this.finishSpeech(token, text);
      window.speechSynthesis.speak(utterance);
    }, 300);
  }

  private finishSpeech(token: number, fallbackText: string | null): void {
    if (token !== this.speechToken) return;
    this.speaking = false;
    this.node<HTMLButtonElement>("replay-instruction").disabled = false;
    this.node<HTMLElement>("listen-status").textContent = "👉 きこえたら タッチ！";

    const fallback = this.node<HTMLElement>("fallback-text");
    if (fallbackText) {
      fallback.textContent = `🔇 おとが でないので もじで みよう：${fallbackText}`;
      fallback.classList.remove("hidden");
    } else {
      fallback.classList.add("hidden");
      fallback.textContent = "";
    }
  }

  private instructionText(targets: ListeningItem[]): string {
    if (targets.length <= 1) return `${targets[0]?.name ?? ""}を タッチしてね`;
    return `${targets[0]?.name ?? ""}を タッチして、つぎに ${targets[1]?.name ?? ""}を タッチしてね`;
  }

  private finishSession(): void {
    this.stopRound();
    this.saveHistory();
    const message =
      this.stats.recovered > 0
        ? `それても ${this.stats.recovered}かい、ミッションに もどれたね！`
        : "さいごまで よく きけたね！";
    this.node<HTMLElement>("result-message").textContent = message;
    audioService.playTone({ frequency: 523, gain: 0.08, durationMs: 160 });
    audioService.playTone({ frequency: 659, gain: 0.08, durationMs: 180, startDelayMs: 130 });
    audioService.playTone({ frequency: 784, gain: 0.08, durationMs: 220, startDelayMs: 270 });
    this.showScreen("result");
  }

  private showHistory(): void {
    this.renderHistory();
    this.showScreen("history");
  }

  private renderHistory(): void {
    const history = this.loadHistory();
    const list = this.node<HTMLElement>("history-list");
    if (history.length === 0) {
      list.innerHTML = '<p class="listening-mission-empty">まだ きろくが ありません。</p>';
      return;
    }

    list.innerHTML = history
      .map(
        (row) => `
          <article class="listening-mission-history-item">
            <div class="listening-mission-history-title">
              <strong>${row.levelLabel}</strong><span>${row.date}</span>
            </div>
            <dl>
              <div><dt>1回でできた</dt><dd>${row.firstTry}/${row.missions}</dd></div>
              <div><dt>聞きなおし</dt><dd>${row.replays}回</dd></div>
              <div><dt>話の途中のタップ</dt><dd>${row.earlyTaps}回</dd></div>
              <div><dt>別のものをタップ</dt><dd>${row.offTargetTaps}回</dd></div>
              <div class="is-highlight"><dt>それても戻れた</dt><dd>${row.recovered}回</dd></div>
            </dl>
          </article>
        `,
      )
      .join("");
  }

  private loadHistory(): ListeningHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is ListeningHistoryRecord => {
        if (typeof item !== "object" || item === null) return false;
        const row = item as Partial<ListeningHistoryRecord>;
        return (
          typeof row.id === "number" &&
          typeof row.date === "string" &&
          (row.level === "one" || row.level === "two") &&
          typeof row.levelLabel === "string" &&
          typeof row.missions === "number" &&
          typeof row.firstTry === "number" &&
          typeof row.replays === "number" &&
          typeof row.earlyTaps === "number" &&
          typeof row.offTargetTaps === "number" &&
          typeof row.recovered === "number"
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
      level: this.level,
      levelLabel: this.levelLabel(this.level),
      missions: SESSION_MISSIONS,
      firstTry: this.stats.firstTry,
      replays: this.stats.replays,
      earlyTaps: this.stats.earlyTaps,
      offTargetTaps: this.stats.offTargetTaps,
      recovered: this.stats.recovered,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  private showScreen(screen: ListeningScreen): void {
    this.screen = screen;
    this.node<HTMLElement>("start-screen").classList.toggle("is-active", screen === "start");
    this.node<HTMLElement>("game-screen").classList.toggle("is-active", screen === "game");
    this.node<HTMLElement>("history-screen").classList.toggle("is-active", screen === "history");
    this.node<HTMLElement>("result-screen").classList.toggle("is-active", screen === "result");
    if (screen !== "game") this.stopRound();
  }

  private setFeedback(message: string, tone: "neutral" | "success" | "return"): void {
    const feedback = this.node<HTMLElement>("feedback");
    feedback.textContent = message;
    feedback.classList.remove("is-success", "is-return");
    if (tone === "success") feedback.classList.add("is-success");
    if (tone === "return") feedback.classList.add("is-return");
  }

  private stopRound(): void {
    if (this.nextTimerId !== null) {
      window.clearTimeout(this.nextTimerId);
      this.nextTimerId = null;
    }
    this.stopSpeech();
  }

  private stopSpeech(): void {
    this.speechToken += 1;
    this.speaking = false;
    if (this.speechTimerId !== null) {
      window.clearTimeout(this.speechTimerId);
      this.speechTimerId = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  private emptyStats(): ListeningSessionStats {
    return { firstTry: 0, replays: 0, earlyTaps: 0, offTargetTaps: 0, recovered: 0 };
  }

  private levelLabel(level: ListeningLevel): string {
    return level === "one" ? "やさしい・1こ" : "ふつう・2こ";
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private node<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing listening-mission node: ${role}`);
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

function initListeningMission(): void {
  const game = new ListeningMissionGame();
  game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initListeningMission, { once: true });
} else {
  initListeningMission();
}
