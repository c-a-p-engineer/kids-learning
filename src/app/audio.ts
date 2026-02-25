interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  interrupt?: boolean;
}

interface ToneOptions {
  frequency: number;
  type?: OscillatorType;
  gain?: number;
  durationMs?: number;
  startDelayMs?: number;
  sweepToFrequency?: number;
}

class AudioService {
  private context: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    return this.context;
  }

  resume(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== "suspended") return;
    void ctx.resume();
  }

  playTone(options: ToneOptions): void {
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const type = options.type ?? "sine";
    const gainValue = Math.max(0.0001, options.gain ?? 0.1);
    const durationSec = Math.max(0.03, (options.durationMs ?? 200) / 1000);
    const delaySec = Math.max(0, (options.startDelayMs ?? 0) / 1000);
    const startAt = ctx.currentTime + delaySec;
    const endAt = startAt + durationSec;
    const releaseAt = Math.min(endAt, startAt + 0.03);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(options.frequency, startAt);
    if (typeof options.sweepToFrequency === "number" && options.sweepToFrequency > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.sweepToFrequency), endAt);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt);
  }

  stopSpeech(): void {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }

  speak(text: string, options?: SpeakOptions): void {
    if (!text || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;

    if (options?.interrupt ?? true) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options?.lang ?? "ja-JP";
    utterance.rate = options?.rate ?? 1;
    utterance.pitch = options?.pitch ?? 1;
    utterance.volume = options?.volume ?? 1;
    window.speechSynthesis.speak(utterance);
  }
}

export const audioService = new AudioService();
