/**
 * 非同期の視覚演出。問題の正解判定と独立し、無音・動き軽減でも進行は同じ。
 */
export type BurstKind = 'correct' | 'clear' | 'review' | 'tap';
let layer: HTMLDivElement | null = null;
let cleanup: number | undefined;
function shouldReduce(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('quiet-mode');
}
export function dismissEffects(): void {
  if (cleanup !== undefined) clearTimeout(cleanup);
  cleanup = undefined;
  layer?.remove();
  layer = null;
}
export function burst(kind: BurstKind, xp?: number): void {
  dismissEffects();
  if (shouldReduce()) return;
  layer = document.createElement('div');
  layer.className = 'reward-overlay';
  layer.setAttribute('aria-hidden', 'true');
  const symbols = kind === 'clear' ? ['🎉','⭐','✨','🌟','🎊'] :
    kind === 'review' ? ['🌈','⭐','💎','✨'] : ['⭐','✨','💛','🌟'];
  const count = kind === 'clear' ? 32 : kind === 'tap' ? 5 : 17;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'reward-particle';
    p.textContent = symbols[i % symbols.length];
    const angle = (i * 137.508 + 20) * Math.PI / 180;
    const distance = (kind === 'clear' ? 135 : 85) + (i % 5) * 25;
    p.style.setProperty('--fly-x', (Math.cos(angle) * distance).toFixed(1) + 'px');
    p.style.setProperty('--fly-y', (Math.sin(angle) * distance).toFixed(1) + 'px');
    p.style.setProperty('--twist', ((i % 2 ? 1 : -1) * (90 + i * 16)) + 'deg');
    p.style.left = (45 + (i % 4) * 3) + '%';
    p.style.top = (kind === 'clear' ? 39 : 46) + '%';
    p.style.animationDelay = (i % 6) * 24 + 'ms';
    layer.appendChild(p);
  }
  const text = document.createElement('span');
  text.className = 'reward-toast';
  text.textContent = kind === 'clear' ? 'クエスト クリア！' :
    kind === 'review' ? 'おぼえてた！' :
    kind === 'correct' ? (xp ? '+' + xp + ' XP ✨' : 'せいかい！') : 'わくわく！';
  layer.appendChild(text);
  document.body.appendChild(layer);
  cleanup = window.setTimeout(dismissEffects, kind === 'clear' ? 1800 : 1080);
}
