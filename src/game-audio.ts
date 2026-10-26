/**
 * 端末だけで演奏する短いBGM/SE。外部音源・通信・再生トラッキングなし。
 * ブラウザの自動再生制限に合わせ、ユーザーの操作後に初めてAudioContextを生成する。
 */
export type MusicScene = 'home' | 'game' | 'result' | 'parent' | 'options';
export type SoundEvent = 'tap' | 'select' | 'correct' | 'retry' | 'hint' | 'clear' | 'review' | 'profile';
const MELODIES: Record<Exclude<MusicScene, 'parent' | 'options'>, number[]> = {
  home: [523,659,784,659,587,659,523,0,440,523,659,523,392,440,523,0],
  game: [440,523,587,659,587,523,494,0,440,523,659,587,523,494,440,0],
  result: [523,659,784,1046,988,784,880,0,784,880,1046,1175,1046,988,784,0]
};
class GameAudio {
  private context: AudioContext | null = null;
  private interval: number | undefined;
  private scene: MusicScene = 'home';
  private step = 0;
  private unlocked = false;
  private bgmOn = false;
  private seOn = false;
  private bgmVolume = 75;
  private seVolume = 65;
  private visible = true;
  private activeSounds = 0;
  constructor() {
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden;
      if (!this.visible) { this.stopLoop(); this.context?.suspend().catch(() => {}); }
      else if (this.unlocked) {
        this.context?.resume().catch(() => {});
        this.restart();
      }
    });
    window.addEventListener('pagehide', () => this.stopLoop());
  }
  private getContext(): AudioContext | null {
    if (!this.context) {
      try { this.context = new AudioContext(); } catch { return null; }
    }
    return this.context;
  }
  /** 必ず実際のタップ・クリックから呼ぶ */
  unlock(): void {
    const firstUnlock = !this.unlocked;
    this.unlocked = true;
    const ctx = this.getContext();
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
    // Clicking an answer must NOT restart the melody or delay the next beat.
    if (firstUnlock) this.restart();
  }
  configure(se: boolean, bgm: boolean, seVolume = 65, bgmVolume = 75): void {
    const restartNeeded = this.bgmOn !== bgm;
    this.seOn = se;
    this.bgmOn = bgm;
    this.seVolume = Math.max(0, Math.min(100, seVolume));
    this.bgmVolume = Math.max(0, Math.min(100, bgmVolume));
    // Gain is applied to each new note; slider movement does not interrupt BGM.
    if (restartNeeded) this.restart();
  }
  setScene(next: MusicScene): void {
    if (this.scene === next) return;
    this.scene = next;
    this.step = 0;
    this.restart();
  }
  private stopLoop(): void {
    if (this.interval !== undefined) window.clearInterval(this.interval);
    this.interval = undefined;
  }
  private restart(): void {
    this.stopLoop();
    if (!this.unlocked || !this.visible || !this.bgmOn || this.scene === 'parent') return;
    this.interval = window.setInterval(() => {
      const melody = MELODIES[(this.scene === 'options' ? 'home' : this.scene) as Exclude<MusicScene, 'parent' | 'options'>];
      const note = melody[this.step % melody.length];
      this.step++;
      if (note) this.playNote(note, 0.19, 0.09 * this.bgmVolume / 100, 'triangle');
      if (this.step % 4 === 1) this.playNote(220, 0.13, 0.022 * this.bgmVolume / 100, 'sine');
    }, 265);
  }
  private playNote(freq: number, duration: number, volume: number, type: OscillatorType, delay = 0): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || this.activeSounds >= 12 || volume <= 0) return;
    this.activeSounds++;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const time = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration + 0.01);
      osc.onended = () => { gain.disconnect(); osc.disconnect(); this.activeSounds--; };
    } catch { this.activeSounds = Math.max(0, this.activeSounds - 1); }
  }
  effect(kind: SoundEvent): void {
    if (!this.unlocked || !this.visible || !this.seOn) return;
    const patterns: Record<SoundEvent, number[]> = {
      tap: [520], select: [440,660], correct: [660,880,1047],
      retry: [350,300], hint: [587,784], clear: [523,659,784,1047,1318],
      review: [660,988,1318], profile: [523,698]
    };
    const notes = patterns[kind];
    const delay = kind === 'clear' ? 0.105 : 0.08;
    notes.forEach((freq, idx) =>
      this.playNote(freq, kind === 'clear' ? 0.25 : 0.15, (kind === 'retry' ? 0.055 : 0.08) * this.seVolume / 100,
        kind === 'retry' ? 'sine' : 'triangle', idx * delay));
  }
}
export const gameAudio = new GameAudio();
