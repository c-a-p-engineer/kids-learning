const EXPERIENCE_SELECTOR = "#traffic-crossing-experience";
const GAME_SCREEN_SELECTOR = '[data-role="game-screen"]';
const FIELD_SELECTOR = '[data-role="field"]';
const CAR_SELECTOR = ".traffic-crossing-car";
const PLAYER_X = 0.5;

class TrafficEngineSound {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private harmonicOscillator: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private animationId: number | null = null;

  init(): void {
    document.addEventListener("pointerdown", (event) => this.handleUserGesture(event), { capture: true });
    document.addEventListener("click", (event) => this.handleUserGesture(event), { capture: true });
    document.addEventListener("keydown", (event) => this.handleKeyGesture(event), { capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.fadeToSilence();
      else this.resume();
    });
    window.addEventListener("pagehide", () => this.fadeToSilence());
    this.animationId = window.requestAnimationFrame(() => this.tick());
  }

  private handleUserGesture(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest(
      `${EXPERIENCE_SELECTOR} [data-level], ${EXPERIENCE_SELECTOR} [data-role="retry"], ${EXPERIENCE_SELECTOR} [data-role="hold-button"]`,
    );
    if (!control) return;
    this.ensureGraph();
    this.resume();
  }

  private handleKeyGesture(event: KeyboardEvent): void {
    if (event.key !== " " && event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest(
      `${EXPERIENCE_SELECTOR} [data-level], ${EXPERIENCE_SELECTOR} [data-role="retry"], ${EXPERIENCE_SELECTOR} [data-role="hold-button"]`,
    );
    if (!control) return;
    this.ensureGraph();
    this.resume();
  }

  private ensureGraph(): void {
    if (this.context) return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const masterGain = context.createGain();
    const filter = context.createBiquadFilter();
    const engineOscillator = context.createOscillator();
    const harmonicOscillator = context.createOscillator();
    const engineGain = context.createGain();
    const harmonicGain = context.createGain();

    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 52;
    harmonicOscillator.type = "square";
    harmonicOscillator.frequency.value = 104;
    engineGain.gain.value = 0.72;
    harmonicGain.gain.value = 0.14;

    filter.type = "lowpass";
    filter.frequency.value = 360;
    filter.Q.value = 0.8;
    masterGain.gain.value = 0.0001;

    engineOscillator.connect(engineGain);
    harmonicOscillator.connect(harmonicGain);
    engineGain.connect(filter);
    harmonicGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);

    engineOscillator.start();
    harmonicOscillator.start();

    this.context = context;
    this.masterGain = masterGain;
    this.filter = filter;
    this.engineOscillator = engineOscillator;
    this.harmonicOscillator = harmonicOscillator;
  }

  private resume(): void {
    const context = this.context;
    if (!context || context.state !== "suspended") return;
    void context.resume();
  }

  private tick(): void {
    this.updateSound();
    this.animationId = window.requestAnimationFrame(() => this.tick());
  }

  private updateSound(): void {
    const context = this.context;
    const masterGain = this.masterGain;
    const engineOscillator = this.engineOscillator;
    const harmonicOscillator = this.harmonicOscillator;
    const filter = this.filter;
    if (!context || !masterGain || !engineOscillator || !harmonicOscillator || !filter) return;

    const experience = document.querySelector<HTMLElement>(EXPERIENCE_SELECTOR);
    const gameScreen = experience?.querySelector<HTMLElement>(GAME_SCREEN_SELECTOR) ?? null;
    const field = experience?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? null;
    const active =
      Boolean(experience) &&
      !experience?.classList.contains("hidden") &&
      Boolean(gameScreen?.classList.contains("is-active")) &&
      !field?.classList.contains("is-impact") &&
      !document.hidden;

    const cars = active ? Array.from(experience?.querySelectorAll<HTMLElement>(CAR_SELECTOR) ?? []) : [];
    if (!active || cars.length === 0) {
      this.setGain(0.0001, 0.08);
      return;
    }

    let nearestDistance = 1;
    for (const car of cars) {
      const left = Number.parseFloat(car.style.left);
      if (!Number.isFinite(left)) continue;
      nearestDistance = Math.min(nearestDistance, Math.abs(left / 100 - PLAYER_X));
    }

    const proximity = Math.max(0, Math.min(1, 1 - nearestDistance / 0.58));
    const trafficDensity = Math.min(1, cars.length / 5);
    const pulse = 0.92 + Math.sin(performance.now() / 72) * 0.08;
    const speaking = "speechSynthesis" in window && window.speechSynthesis.speaking;
    const speechDuck = speaking ? 0.28 : 1;

    const targetGain = (0.0045 + proximity * 0.013 + trafficDensity * 0.0035) * pulse * speechDuck;
    const baseFrequency = 48 + proximity * 24 + trafficDensity * 5;
    const now = context.currentTime;

    masterGain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.08);
    engineOscillator.frequency.setTargetAtTime(baseFrequency, now, 0.11);
    harmonicOscillator.frequency.setTargetAtTime(baseFrequency * 2.03, now, 0.11);
    filter.frequency.setTargetAtTime(300 + proximity * 180, now, 0.12);
  }

  private setGain(value: number, timeConstant: number): void {
    if (!this.context || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, timeConstant);
  }

  private fadeToSilence(): void {
    this.setGain(0.0001, 0.03);
  }
}

const trafficEngineSound = new TrafficEngineSound();
trafficEngineSound.init();
