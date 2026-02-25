import { audioService } from "../app/audio";

type DotBurstLevel = "BEGINNER" | "NORMAL";

interface DotBurstRecord {
  s: number;
  o: number;
  n: number;
  d: string;
  l: DotBurstLevel;
  t: number;
}

const STORAGE_KEY = "dot_burst_v8";
const GAME_DURATION_MS = 30_000;

export class DotBurstGame {
  private readonly root: HTMLElement;
  private active = false;
  private currentLevel: DotBurstLevel = "NORMAL";
  private score = 0;
  private ok = 0;
  private ng = 0;
  private combo = 0;
  private currentCount = 0;
  private startTime = 0;
  private timerId = 0;
  private historySort: "datetime" | "score" = "datetime";

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    this.bindEvents();
    this.updateUI();
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.toggleModal("start-modal", true);
    this.toggleModal("result-modal", false);
    this.toggleModal("history-modal", false);
  }

  hide(): void {
    this.active = false;
    if (this.timerId !== 0) {
      window.cancelAnimationFrame(this.timerId);
      this.timerId = 0;
    }
    this.root.classList.add("hidden");
  }

  private template(): string {
    return `
      <div class="dotburst-game">
        <div class="dotburst-header">
          <div class="dotburst-time">⏳<span data-role="time-val">30.0</span></div>
          <div class="dotburst-score">✨<span data-role="score-val">0</span></div>
        </div>

        <div class="dotburst-stats">
          <div class="dotburst-stat"><span class="dotburst-emoji">⭕</span><span data-role="live-ok" class="dotburst-val dotburst-val--ok">0</span></div>
          <div class="dotburst-stat"><span class="dotburst-emoji">❌</span><span data-role="live-ng" class="dotburst-val dotburst-val--ng">0</span></div>
          <div class="dotburst-stat"><span class="dotburst-emoji">🔥</span><span data-role="live-combo" class="dotburst-val">0</span></div>
        </div>

        <div class="dotburst-display" data-role="display-area">
          <div data-role="dots-container"></div>
          <div class="dotburst-feedback" data-role="feedback">⭕</div>
        </div>

        <div class="dotburst-input" data-role="input-grid"></div>

        <div class="dotburst-modal" data-role="start-modal">
          <div class="dotburst-title-area">
            <div class="dotburst-title-emoji">🎯</div>
            <h2 class="dotburst-title">DOT BURST</h2>
          </div>

          <button type="button" data-role="start-beginner" class="dotburst-menu-btn">🐣 かんたん (1-5)</button>
          <button type="button" data-role="start-normal" class="dotburst-menu-btn">🦁 ふつう (1-10)</button>
          <button type="button" data-role="open-history" class="dotburst-link-btn">📜 記録をみる</button>
        </div>

        <div class="dotburst-modal hidden" data-role="result-modal">
          <div class="dotburst-result-icon">🏆</div>
          <h3 class="dotburst-result-title">おしまい！</h3>

          <div class="dotburst-result-score-wrap">
            <div class="dotburst-result-label">今回のスコア</div>
            <div class="dotburst-result-score" data-role="final-score">0</div>
          </div>

          <div class="dotburst-result-stats">
            <div>⭕ <span data-role="res-ok">0</span></div>
            <div>❌ <span data-role="res-ng">0</span></div>
          </div>

          <div class="dotburst-best" data-role="best-score-label"></div>
          <button type="button" data-role="go-home" class="dotburst-menu-btn">🏠 ホームにもどる</button>
        </div>

        <div class="dotburst-modal hidden" data-role="history-modal">
          <h3 class="dotburst-history-title">📜 これまでの記録</h3>
          <div class="dotburst-history-sort">
            <button type="button" data-role="sort-datetime" class="dotburst-sort-btn is-active">日時順</button>
            <button type="button" data-role="sort-score" class="dotburst-sort-btn">スコア順</button>
          </div>
          <div class="dotburst-history-box" data-role="history-list"></div>
          <button type="button" data-role="close-history" class="dotburst-menu-btn">もどる</button>
        </div>
      </div>
    `;
  }

  private getNode<T extends HTMLElement>(role: string): T {
    const element = this.root.querySelector(`[data-role="${role}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing dotburst node: ${role}`);
    }
    return element as T;
  }

  private bindEvents(): void {
    this.getNode<HTMLButtonElement>("start-beginner").addEventListener("click", () => this.startGame("BEGINNER"));
    this.getNode<HTMLButtonElement>("start-normal").addEventListener("click", () => this.startGame("NORMAL"));
    this.getNode<HTMLButtonElement>("open-history").addEventListener("click", () => this.toggleHistory(true));
    this.getNode<HTMLButtonElement>("close-history").addEventListener("click", () => this.toggleHistory(false));
    this.getNode<HTMLButtonElement>("go-home").addEventListener("click", () => this.goHome());
    this.getNode<HTMLButtonElement>("sort-datetime").addEventListener("click", () => {
      this.historySort = "datetime";
      this.renderHistory();
    });
    this.getNode<HTMLButtonElement>("sort-score").addEventListener("click", () => {
      this.historySort = "score";
      this.renderHistory();
    });

    this.getNode<HTMLElement>("input-grid").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const value = Number.parseInt(target.dataset.value ?? "", 10);
      if (!Number.isInteger(value)) return;
      this.checkAnswer(value);
    });
  }

  private startGame(level: DotBurstLevel): void {
    audioService.resume();
    this.currentLevel = level;
    this.resetGameStats();
    this.initButtons();
    this.active = true;
    this.startTime = performance.now();
    this.toggleModal("start-modal", false);
    this.toggleModal("result-modal", false);
    this.toggleModal("history-modal", false);
    this.tick();
    this.nextQuestion();
  }

  private tick = (): void => {
    if (!this.active) return;

    const remaining = GAME_DURATION_MS - (performance.now() - this.startTime);
    if (remaining <= 0) {
      this.endGame();
      return;
    }

    this.getNode<HTMLElement>("time-val").textContent = (remaining / 1000).toFixed(1);
    this.timerId = window.requestAnimationFrame(this.tick);
  };

  private initButtons(): void {
    const grid = this.getNode<HTMLElement>("input-grid");
    const max = this.currentLevel === "BEGINNER" ? 5 : 10;
    grid.innerHTML = "";

    for (let i = 1; i <= max; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dotburst-num-btn";
      button.dataset.value = String(i);
      button.textContent = String(i);
      grid.appendChild(button);
    }
  }

  private nextQuestion(): void {
    const container = this.getNode<HTMLElement>("dots-container");
    const displayArea = this.getNode<HTMLElement>("display-area");
    container.innerHTML = "";

    const max = this.currentLevel === "BEGINNER" ? 5 : 10;
    this.currentCount = Math.floor(Math.random() * max) + 1;

    const rect = displayArea.getBoundingClientRect();
    const dots: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < this.currentCount; i += 1) {
      let x = 0;
      let y = 0;
      let attempts = 0;

      while (attempts < 50) {
        x = Math.random() * (rect.width - 65) + 5;
        y = Math.random() * (rect.height - 65) + 5;
        if (!dots.some((dot) => Math.hypot(dot.x - x, dot.y - y) < 60)) break;
        attempts += 1;
      }

      dots.push({ x, y });
      const dot = document.createElement("div");
      dot.className = "dotburst-dot";
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      container.appendChild(dot);

      window.setTimeout(() => {
        dot.classList.add("is-show");
      }, i * 30);
    }
  }

  private checkAnswer(value: number): void {
    if (!this.active) return;

    if (value === this.currentCount) {
      this.ok += 1;
      this.combo += 1;
      this.score += 100 * this.combo;
      this.beep(440 + this.combo * 30, "sine");
      this.showFeedback("⭕", "var(--dotburst-accent-ok)");
    } else {
      this.ng += 1;
      this.combo = 0;
      this.beep(140, "square");
      this.showFeedback("❌", "var(--dotburst-accent-ng)");
    }

    this.updateUI();
    this.nextQuestion();
  }

  private showFeedback(text: string, color: string): void {
    const feedback = this.getNode<HTMLElement>("feedback");
    feedback.textContent = text;
    feedback.style.color = color;
    feedback.classList.remove("is-animating");
    void feedback.offsetWidth;
    feedback.classList.add("is-animating");
  }

  private updateUI(): void {
    this.getNode<HTMLElement>("live-ok").textContent = String(this.ok);
    this.getNode<HTMLElement>("live-ng").textContent = String(this.ng);
    this.getNode<HTMLElement>("live-combo").textContent = String(this.combo);
    this.getNode<HTMLElement>("score-val").textContent = this.score.toLocaleString();
  }

  private beep(freq: number, type: OscillatorType): void {
    audioService.playTone({
      frequency: freq,
      type,
      gain: 0.1,
      durationMs: 200,
    });
  }

  private endGame(): void {
    this.active = false;
    if (this.timerId !== 0) {
      window.cancelAnimationFrame(this.timerId);
      this.timerId = 0;
    }

    const best = this.saveRecord(this.score, this.ok, this.ng);

    this.getNode<HTMLElement>("final-score").textContent = this.score.toLocaleString();
    this.getNode<HTMLElement>("res-ok").textContent = String(this.ok);
    this.getNode<HTMLElement>("res-ng").textContent = String(this.ng);

    const bestLabel = this.getNode<HTMLElement>("best-score-label");
    bestLabel.textContent =
      this.score >= best ? "🎉 じこベストこうしん！" : `ベストきろく: ${best.toLocaleString()}`;

    this.toggleModal("result-modal", true);
  }

  private saveRecord(score: number, ok: number, ng: number): number {
    const history = this.readHistory();
    const now = new Date();
    const timestamp = now.getTime();
    history.unshift({
      s: score,
      o: ok,
      n: ng,
      l: this.currentLevel,
      t: timestamp,
      d: this.formatDateTime(timestamp),
    });
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    const sameLevelScores = trimmed.filter((item) => item.l === this.currentLevel).map((item) => item.s);
    if (sameLevelScores.length === 0) return score;
    return Math.max(...sameLevelScores);
  }

  private readHistory(): DotBurstRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((item): item is DotBurstRecord => {
        if (typeof item !== "object" || item === null) return false;
        const record = item as Partial<DotBurstRecord>;
        const level = record.l === "BEGINNER" || record.l === "NORMAL" ? record.l : "NORMAL";
        const timestamp = typeof record.t === "number" ? record.t : this.parseLegacyTimestamp(record.d);
        if (typeof record.s !== "number" || typeof record.o !== "number" || typeof record.n !== "number") {
          return false;
        }
        if (typeof record.d !== "string") {
          return false;
        }
        Object.assign(record, { l: level, t: timestamp });
        return (
          typeof record.l === "string" &&
          typeof record.t === "number"
        );
      });
    } catch {
      return [];
    }
  }

  private renderHistory(): void {
    const history = this.readHistory();
    const sortRecords = (records: DotBurstRecord[]): DotBurstRecord[] => [...records].sort((a, b) => {
      if (this.historySort === "score") {
        if (b.s !== a.s) return b.s - a.s;
        return b.t - a.t;
      }
      return b.t - a.t;
    });

    const beginnerRecords = sortRecords(history.filter((record) => record.l === "BEGINNER"));
    const normalRecords = sortRecords(history.filter((record) => record.l === "NORMAL"));
    const list = this.getNode<HTMLElement>("history-list");
    this.getNode<HTMLButtonElement>("sort-datetime").classList.toggle("is-active", this.historySort === "datetime");
    this.getNode<HTMLButtonElement>("sort-score").classList.toggle("is-active", this.historySort === "score");
    list.innerHTML = "";

    if (beginnerRecords.length === 0 && normalRecords.length === 0) {
      list.innerHTML = '<div class="dotburst-history-empty">きろくがありません</div>';
      return;
    }

    const appendSection = (title: string, records: DotBurstRecord[]): void => {
      const section = document.createElement("section");
      section.className = "dotburst-history-section";
      section.innerHTML = `<h4 class="dotburst-history-section-title">${title}</h4>`;

      if (records.length === 0) {
        const empty = document.createElement("div");
        empty.className = "dotburst-history-section-empty";
        empty.textContent = "きろくがありません";
        section.appendChild(empty);
        list.appendChild(section);
        return;
      }

      records.forEach((record) => {
        const item = document.createElement("div");
        item.className = "dotburst-history-item";
        item.innerHTML = `
          <div>${record.d}</div>
          <div class="dotburst-history-score">${record.s.toLocaleString()}</div>
          <div class="dotburst-history-ok">⭕${record.o}</div>
          <div class="dotburst-history-ng">❌${record.n}</div>
        `;
        section.appendChild(item);
      });
      list.appendChild(section);
    };

    appendSection("🐣 かんたん", beginnerRecords);
    appendSection("🦁 ふつう", normalRecords);
  }

  private toggleHistory(show: boolean): void {
    this.toggleModal("history-modal", show);
    if (show) {
      this.renderHistory();
    }
  }

  private formatDateTime(timestamp: number): string {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  private parseLegacyTimestamp(dateText: string | undefined): number {
    if (!dateText) return 0;
    const timestamp = Date.parse(dateText);
    if (!Number.isNaN(timestamp)) return timestamp;

    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
    if (!matched) return 0;
    const [_, y, m, d] = matched;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }

  private resetGameStats(): void {
    this.score = 0;
    this.ok = 0;
    this.ng = 0;
    this.combo = 0;
    this.getNode<HTMLElement>("time-val").textContent = "30.0";
    this.updateUI();
  }

  private goHome(): void {
    this.resetGameStats();
    this.toggleModal("result-modal", false);
    this.toggleModal("start-modal", true);
  }

  private toggleModal(role: "start-modal" | "result-modal" | "history-modal", show: boolean): void {
    this.getNode<HTMLElement>(role).classList.toggle("hidden", !show);
  }
}
