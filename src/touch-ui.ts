import type { Question } from './engine';
import { isTouchGame } from './touch-content';
export interface TouchState { done: number[]; hour: number; minute: number; message: string }
export interface TouchResult { finished: boolean; value?: string; practice?: boolean }
export function freshTouch(): TouchState { return { done: [], hour: 12, minute: 0, message: '' }; }
const escape = (s: string): string => s.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
function clockSvg(hour: number, minute: number): string {
  const hand = (deg: number, len: number, width: number, color: string) => {
    const radians = (deg - 90) * Math.PI / 180;
    return '<line x1="100" y1="100" x2="' + (100 + Math.cos(radians) * len).toFixed(2) +
      '" y2="' + (100 + Math.sin(radians) * len).toFixed(2) + '" stroke="' + color +
      '" stroke-width="' + width + '" stroke-linecap="round"/>';
  };
  const labels = Array.from({ length: 12 }, (_, n) => {
    const a = (n * 30 - 60) * Math.PI / 180;
    return '<text x="' + (100 + Math.cos(a) * 78).toFixed(1) + '" y="' +
      (104 + Math.sin(a) * 78).toFixed(1) + '" text-anchor="middle" font-size="14" font-weight="900">' +
      (n + 1) + '</text>';
  }).join('');
  return '<svg class="hands-clock" viewBox="0 0 200 200" role="img" aria-label="いま ' + hour +
    'じ ' + minute + 'ふん"><circle cx="100" cy="100" r="98" fill="#f6fbff" stroke="#89afe6" stroke-width="4"/>' +
    labels + hand(((hour % 12) + minute / 60) * 30, 49, 8, '#4269ba') +
    hand(minute * 6, 68, 5, '#e78c58') + '<circle cx="100" cy="100" r="6" fill="#425a98"/></svg>';
}
export function touchHtml(q: Question, state: TouchState, disabled: boolean): string {
  if (!isTouchGame(q.gameId)) return '';
  if (q.gameId === 'connect') {
    const total = q.visual.a ?? 5;
    return '<div class="touch-activity"><p class="touch-tip">1 → 2 → 3 の じゅんに タップ！</p>' +
      '<div class="connect-grid">' + Array.from({ length: total }, (_, i) =>
        '<button type="button" data-touch="connect" data-index="' + (i + 1) +
        '" class="connect-dot' + (state.done.includes(i + 1) ? ' visited' : '') +
        '"' + (disabled || state.done.includes(i + 1) ? ' disabled' : '') +
        ' aria-label="' + (i + 1) + 'ばんの てん">' + (i + 1) + '</button>').join('') +
      '</div><p class="touch-tip">つながったよ：' + state.done.length + '/' + total + '</p>' +
      '<button type="button" class="touch-reset" data-touch="restart" ' +
      (disabled ? 'disabled' : '') + '>↻ やりなおす</button></div>';
  }
  if (q.gameId === 'maze') {
    const size = q.visual.a ?? 3, route = q.visual.numbers ?? [];
    const start = route[0], goal = route[route.length - 1];
    const current = state.done.length ? state.done[state.done.length - 1] : start;
    const cells = Array.from({ length: size * size }, (_, i) =>
      '<button type="button" class="maze-cell' + (!route.includes(i) ? ' wall' : '') +
      (state.done.includes(i) ? ' walked' : '') + (i === start ? ' start' : '') +
      (i === goal ? ' goal' : '') + '" data-touch="maze" data-index="' + i +
      '"' + (disabled || !route.includes(i) ? ' disabled' : '') +
      ' aria-label="' + (i === start ? 'スタート' : i === goal ? 'ゴール' : 'みち') +
      '">' + (i === start ? '🚂' : i === goal ? '⭐' : state.done.includes(i) ? '✨' : '') + '</button>').join('');
    return '<div class="touch-activity"><p class="touch-tip">🚂 から ⭐ まで となりの みちを タップ</p>' +
      '<div class="maze-grid" style="--maze-columns:' + size + '">' + cells + '</div>' +
      '<p class="touch-tip">いまの ばしょ：' + (state.done.length ? '✨' : '🚂') + '　' + escape(state.message) + '</p>' +
      '<button type="button" class="touch-reset" data-touch="restart"' + (disabled ? ' disabled' : '') +
      '>↻ さいしょから</button></div>';
  }
  const step = q.visual.step ?? 30;
  const minuteText = state.minute === 0 ? '00' : String(state.minute).padStart(2, '0');
  return '<div class="touch-activity"><p class="touch-tip">はりを うごかして じかんを あわせよう</p>' +
    clockSvg(state.hour, state.minute) +
    '<p class="clock-current" aria-live="polite">' + state.hour + ':' + minuteText + '</p>' +
    '<div class="clock-controls"><div><strong>みじかい はり</strong>' +
    '<button type="button" data-touch="hour-minus"' + (disabled ? ' disabled' : '') + ' aria-label="じかんを 1もどす">−</button>' +
    '<button type="button" data-touch="hour-plus"' + (disabled ? ' disabled' : '') + ' aria-label="じかんを 1すすめる">＋</button></div>' +
    '<div><strong>ながい はり</strong>' +
    '<button type="button" data-touch="minute-minus"' + (disabled ? ' disabled' : '') + ' aria-label="ふんを ' + step + 'もどす">−</button>' +
    '<button type="button" data-touch="minute-plus"' + (disabled ? ' disabled' : '') + ' aria-label="ふんを ' + step + 'すすめる">＋</button></div></div>' +
    '<button type="button" class="clock-check" data-touch="clock-check"' + (disabled ? ' disabled' : '') +
    '>✅ できた！</button><p role="status" class="touch-tip">' + escape(state.message) + '</p></div>';
}
/** Deterministic controller for tap activities. Never awards XP itself. */
export function touchClick(q: Question, state: TouchState, action: string, index = -1): TouchResult {
  if (!isTouchGame(q.gameId)) return { finished: false };
  if (action === 'restart') { state.done = []; state.hour = 12; state.minute = 0; state.message = ''; return { finished: false }; }
  if (q.gameId === 'connect') {
    if (action !== 'connect' || index !== state.done.length + 1) {
      state.message = '1から じゅんばんに おしてみよう'; return { finished: false };
    }
    state.done.push(index);
    if (state.done.length === (q.visual.a ?? 5)) return { finished: true, value: q.answer, practice: true };
  } else if (q.gameId === 'maze') {
    if (action !== 'maze') return { finished: false };
    const route = q.visual.numbers ?? [], size = q.visual.a ?? 3;
    const pos = state.done.length ? state.done[state.done.length - 1] : route[0];
    if (!route.includes(index) || ![pos - size, pos + size,
      pos % size !== 0 ? pos - 1 : -1, pos % size < size - 1 ? pos + 1 : -1].includes(index)) {
      state.message = 'となりの みちを えらんでね'; return { finished: false };
    }
    state.done.push(index);
    if (index === route[route.length - 1]) return { finished: true, value: q.answer, practice: true };
  } else {
    const step = q.visual.step ?? 30;
    if (action === 'hour-plus') state.hour = state.hour % 12 + 1;
    if (action === 'hour-minus') state.hour = (state.hour + 10) % 12 + 1;
    if (action === 'minute-plus') state.minute = (state.minute + step) % 60;
    if (action === 'minute-minus') state.minute = (state.minute + 60 - step) % 60;
    if (action === 'clock-check') {
      if (state.hour === q.visual.hour && state.minute === q.visual.minute)
        return { finished: true, value: q.answer };
      state.message = 'あと すこし！ はりを みてね';
    } else state.message = '';
  }
  return { finished: false };
}
