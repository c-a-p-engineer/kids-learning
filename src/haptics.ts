/** Optional tactile feedback. Unsupported browsers silently continue without vibration. */
export type HapticCue = 'tap' | 'correct' | 'retry' | 'clear' | 'level';
export const HAPTIC_PATTERNS: Record<HapticCue, number | number[]> = {
  tap: 12, correct: 32, retry: [35, 45, 35], clear: [35, 45, 65],
  level: [35, 50, 45, 50, 75]
};
export interface HapticsSettings { haptics: boolean; quiet: boolean }
export interface HapticsAdapter {
  vibrate?: (pattern: number | number[]) => boolean;
  reducedMotion?: boolean;
}
/** No timers, long vibration, external hardware libraries or persistent sensors. */
export function emitHaptic(cue: HapticCue, settings: HapticsSettings,
  adapter: HapticsAdapter): boolean {
  if (!settings.haptics || settings.quiet || adapter.reducedMotion ||
      typeof adapter.vibrate !== 'function') return false;
  try { return adapter.vibrate(HAPTIC_PATTERNS[cue]); }
  catch { return false; }
}
export function haptic(cue: HapticCue, settings: HapticsSettings): boolean {
  if (typeof navigator === 'undefined') return false;
  const reducedMotion = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  return emitHaptic(cue, settings, {
    reducedMotion,
    vibrate: typeof navigator.vibrate === 'function' ?
      pattern => navigator.vibrate(pattern) : undefined
  });
}
