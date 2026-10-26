import type { Question } from './engine';
import { isTouchGame } from './touch-content';

export type Point = readonly [number, number];
export type Hand = 'hour' | 'minute';
export interface TouchState {
  done: number[];
  hour: number;
  minute: number;
  message: string;
  pointerId: number | null;
  drawing: boolean;
  hand: Hand | null;
  last: Point | null;
  ink: Point[];
  altOpen: boolean;
}
export interface TouchResult { finished: boolean; value?: string; practice?: boolean; refresh?: boolean }
export function freshTouch(): TouchState {
  return { done: [], hour: 12, minute: 0, message: '', pointerId: null,
    drawing: false, hand: null, last: null, ink: [], altOpen: false };
}
const escape = (s: string): string => s.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const VIEW = 300, ROAD_RADIUS = 27, DOT_RADIUS = 26;
const CONNECT_CELLS: Point[] = [
  [45, 55], [115, 55], [185, 55], [255, 55], [255, 130],
  [185, 130], [115, 130], [45, 130], [45, 205], [115, 205]
];
/** A line to follow, not a grid of number buttons. */
export function connectRoute(total: number, variant: number): Point[] {
  return CONNECT_CELLS.slice(0, total).map(([x, y]) => [
    variant % 2 ? VIEW - x : x, variant % 4 >= 2 ? VIEW - y : y
  ] as Point);
}
export function routePoints(q: Question): Point[] {
  if (q.gameId === 'connect') return connectRoute(q.visual.a ?? 5, q.visual.b ?? 0);
  const size = q.visual.a ?? 3;
  return (q.visual.numbers ?? []).map(cell => [
    (cell % size + .5) * VIEW / size,
    (Math.floor(cell / size) + .5) * VIEW / size
  ] as Point);
}
const pointString = (p: Point): string => p.map(v => v.toFixed(1)).join(',');
function routeHtml(q: Question, state: TouchState, disabled: boolean): string {
  const points = routePoints(q);
  const maze = q.gameId === 'maze', path = points.map(pointString).join(' ');
  const bg = maze ? Array.from({ length: (q.visual.a ?? 3) ** 2 }, (_, n) => {
    const size = q.visual.a ?? 3, width = VIEW / size;
    const open = (q.visual.numbers ?? []).includes(n);
    const x = (n % size) * width, y = Math.floor(n / size) * width;
    return '<rect x="' + (x + 2) + '" y="' + (y + 2) +
      '" width="' + (width - 4) + '" height="' + (width - 4) +
      '" rx="10" fill="' + (open ? '#fff6da' : '#7fa4bf') + '"/>';
  }).join('') : '';
  const dots = points.map(([x, y], i) =>
    '<g aria-hidden="true"><circle cx="' + x + '" cy="' + y + '" r="' +
    (maze ? 14 : 20) + '" fill="' + (i < state.done.length ? '#82d7b7' : '#fff4cd') +
    '" stroke="' + (i < state.done.length ? '#31a586' : '#dcaf51') + '" stroke-width="3"/>' +
    '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="' +
    (maze ? 17 : 18) + '" font-weight="900" fill="#4c5881">' +
    (maze ? i === 0 ? '🚂' : i === points.length - 1 ? '★' : '·' : i + 1) +
    '</text></g>').join('');
  const ink = state.ink.map(pointString).join(' ');
  const next = state.done.length ? state.done.length + 1 : 1;
  return '<div class="touch-activity"><p class="touch-tip">' +
    (maze ? '🚂 から ★ まで ゆびで みちを なぞろう' :
      '1から じゅんに ゆびで せんを なぞろう') + '</p>' +
    '<div class="path-trace-board"><svg data-touch-trace viewBox="0 0 300 300" role="img" aria-label="' +
    (maze ? 'でんしゃから ほしまでの みちを なぞる' : '1から ' + points.length + ' まで せんを なぞる') +
    '">' + bg +
    '<polyline points="' + path + '" fill="none" stroke="' + (maze ? '#fbe6ad' : '#ddeaff') +
    '" stroke-width="' + (maze ? '42' : '35') +
    '" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<polyline points="' + path + '" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="4 13"/>' +
    '<polyline data-touch-ink points="' + ink +
    '" fill="none" stroke="#39a9a1" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>' +
    dots + '</svg></div>' +
    '<p class="touch-tip" role="status">' + (state.message || 'はじめの まるから さいごまで、ゆびを はなさずに！') + '</p>' +
    '<button type="button" class="touch-reset" data-touch="restart"' + (disabled ? ' disabled' : '') +
    '>↻ やりなおす</button>' +
    '<details class="touch-fallback"' + (state.altOpen ? ' open' : '') +
    '><summary>なぞるのが むずかしいとき</summary><p>じゅんばんに タップしても いいよ</p>' +
    '<button type="button" data-touch="path-step"' + (disabled ? ' disabled' : '') +
    '>● ' + next + ' ばんめの てん</button></details></div>';
}
function clockAngle(hour: number, minute: number): number { return ((hour % 12) + minute / 60) * 30; }
function clockSvg(hour: number, minute: number): string {
  const hourDeg = clockAngle(hour, minute), minuteDeg = minute * 6;
  const hand = (kind: Hand, deg: number, length: number, color: string): string =>
    '<g data-clock-rotation="' + kind + '" transform="rotate(' + deg + ' 100 100)">' +
    '<line x1="100" y1="100" x2="100" y2="' + (100 - length) +
    '" stroke="' + color + '" stroke-width="' + (kind === 'hour' ? 9 : 6) +
    '" stroke-linecap="round"/>' +
    '<line data-clock-hand="' + kind + '" x1="100" y1="100" x2="100" y2="' + (100 - length) +
    '" stroke="transparent" stroke-width="33" stroke-linecap="round"/>' +
    '<circle data-clock-hand="' + kind + '" cx="100" cy="' + (100 - length) +
    '" r="15" fill="' + color + '" stroke="#fff" stroke-width="3"/></g>';
  const labels = Array.from({ length: 12 }, (_, n) => {
    const a = (n * 30 - 60) * Math.PI / 180;
    return '<text x="' + (100 + Math.cos(a) * 78).toFixed(1) + '" y="' +
      (104 + Math.sin(a) * 78).toFixed(1) + '" text-anchor="middle" font-size="14" font-weight="900">' +
      (n + 1) + '</text>';
  }).join('');
  return '<svg class="hands-clock" data-clock-face viewBox="0 0 200 200" role="img" aria-label="いま ' +
    hour + 'じ ' + minute + 'ふん。あおい みじかい はりと オレンジの ながい はりを つかんで まわそう">' +
    '<circle cx="100" cy="100" r="98" fill="#f6fbff" stroke="#89afe6" stroke-width="4"/>' +
    labels + hand('minute', minuteDeg, 70, '#e78c58') + hand('hour', hourDeg, 48, '#4269ba') +
    '<circle cx="100" cy="100" r="7" fill="#425a98"/></svg>';
}
export function touchHtml(q: Question, state: TouchState, disabled: boolean): string {
  if (!isTouchGame(q.gameId)) return '';
  if (q.gameId === 'connect' || q.gameId === 'maze') return routeHtml(q, state, disabled);
  const step = q.visual.step ?? 30;
  const minuteText = String(state.minute).padStart(2, '0');
  return '<div class="touch-activity"><p class="touch-tip">はりを つかんで ぐるっと まわそう！</p>' +
    clockSvg(state.hour, state.minute) +
    '<div class="clock-hand-guide"><span>🔵 あおい はり：じかん</span><span>🟠 オレンジ：ふん</span></div>' +
    '<p class="clock-current" aria-live="polite">' + state.hour + ':' + minuteText + '</p>' +
    '<button type="button" class="clock-check" data-touch="clock-check"' + (disabled ? ' disabled' : '') +
    '>✅ できた！</button>' +
    '<details class="touch-fallback"' + (state.altOpen ? ' open' : '') +
    '><summary>はりを つかみにくいとき</summary>' +
    '<div class="clock-controls"><div><strong>みじかい はり</strong>' +
    '<button type="button" data-touch="hour-minus"' + (disabled ? ' disabled' : '') + ' aria-label="じかんを 1もどす">−</button>' +
    '<button type="button" data-touch="hour-plus"' + (disabled ? ' disabled' : '') + ' aria-label="じかんを 1すすめる">＋</button></div>' +
    '<div><strong>ながい はり</strong>' +
    '<button type="button" data-touch="minute-minus"' + (disabled ? ' disabled' : '') + ' aria-label="ふんを ' + step + 'もどす">−</button>' +
    '<button type="button" data-touch="minute-plus"' + (disabled ? ' disabled' : '') + ' aria-label="ふんを ' + step + 'すすめる">＋</button></div></div></details>' +
    '<p class="touch-tip" role="status">' + escape(state.message) + '</p></div>';
}
function resetRoute(state: TouchState, message = ''): TouchResult {
  state.done = []; state.ink = []; state.drawing = false; state.pointerId = null;
  state.last = null; state.message = message;
  return { finished: false, refresh: true };
}
/** Used by the accessible step-by-step alternative; the main control is finger tracing. */
export function touchClick(q: Question, state: TouchState, action: string, index = -1): TouchResult {
  if (!isTouchGame(q.gameId)) return { finished: false };
  if (action === 'restart') return resetRoute(state);
  if (q.gameId === 'connect' || q.gameId === 'maze') {
    const points = routePoints(q);
    const next = state.done.length;
    const requested = action === 'path-step' ? next :
      q.gameId === 'connect' && action === 'connect' ? index - 1 :
      q.gameId === 'maze' && action === 'maze' ? (q.visual.numbers ?? []).indexOf(index) : -1;
    if (requested !== next || next >= points.length)
      return { finished: false, refresh: true };
    state.altOpen = true; state.done.push(next);
    state.message = '';
    if (state.done.length === points.length)
      return { finished: true, value: q.answer, practice: true };
    return { finished: false, refresh: true };
  }
  const step = q.visual.step ?? 30;
  if (['hour-plus', 'hour-minus', 'minute-plus', 'minute-minus'].includes(action)) state.altOpen = true;
  if (action === 'hour-plus') state.hour = state.hour % 12 + 1;
  if (action === 'hour-minus') state.hour = (state.hour + 10) % 12 + 1;
  if (action === 'minute-plus') state.minute = (state.minute + step) % 60;
  if (action === 'minute-minus') state.minute = (state.minute + 60 - step) % 60;
  if (action === 'clock-check') {
    if (state.hour === q.visual.hour && state.minute === q.visual.minute)
      return { finished: true, value: q.answer };
    state.message = 'あと すこし！ はりを みてね';
  } else state.message = '';
  return { finished: false, refresh: true };
}
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) /
    Math.max(1, dx * dx + dy * dy)));
  return dist(p, [a[0] + dx * t, a[1] + dy * t]);
}
/** Pure path-trace policy. A swipe across scattered buttons cannot bypass the continuous route. */
export function traceRouteSample(q: Question, state: TouchState,
  phase: 'down' | 'move' | 'up' | 'cancel', position: Point): TouchResult {
  if (q.gameId !== 'connect' && q.gameId !== 'maze') return { finished: false };
  const points = routePoints(q);
  if (!points.length) return { finished: false };
  if (phase === 'cancel') return resetRoute(state);
  if (phase === 'down') {
    if (dist(position, points[0]) > DOT_RADIUS)
      return { finished: false, refresh: true };
    state.drawing = true; state.done = [0]; state.ink = [position];
    state.last = position; state.message = '';
    return { finished: false };
  }
  if (!state.drawing || !state.last) return { finished: false };
  const length = dist(position, state.last);
  const steps = Math.max(1, Math.ceil(length / 6));
  for (let i = 1; i <= steps; i++) {
    const p: Point = [
      state.last[0] + (position[0] - state.last[0]) * i / steps,
      state.last[1] + (position[1] - state.last[1]) * i / steps
    ];
    const next = state.done.length;
    const start = points[Math.max(0, next - 1)], end = points[Math.min(next, points.length - 1)];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) ||
      segmentDistance(p, start, end) > ROAD_RADIUS)
      return resetRoute(state, 'みちから はずれちゃった！ もういちど なぞろう');
    if (next < points.length && dist(p, points[next]) <= DOT_RADIUS) state.done.push(next);
  }
  state.last = position;
  if (state.ink.length < 750) state.ink.push(position);
  if (phase === 'up') {
    if (state.done.length === points.length && dist(position, points[points.length - 1]) <= DOT_RADIUS) {
      state.drawing = false; state.pointerId = null;
      return { finished: true, value: q.answer, practice: true };
    }
    return resetRoute(state, 'さいごまで ひとふでで なぞってみよう');
  }
  return { finished: false };
}
/** Clock hands snap to level-specific increments. Rotation and checking remain independent. */
export function rotateClockHand(q: Question, state: TouchState, hand: Hand, position: Point): void {
  if (q.gameId !== 'clockhands') return;
  const angle = (Math.atan2(position[1] - 100, position[0] - 100) * 180 / Math.PI + 90 + 360) % 360;
  if (hand === 'minute') {
    const step = q.visual.step ?? 30;
    state.minute = (Math.round(angle / (6 * step)) * step) % 60;
  } else {
    const adjusted = (angle - state.minute / 2 + 360) % 360;
    state.hour = Math.round(adjusted / 30) % 12 || 12;
  }
  state.message = '';
}
const completedClock = (q: Question, state: TouchState): TouchResult =>
  state.hour === q.visual.hour && state.minute === q.visual.minute ?
    { finished: true, value: q.answer } : { finished: false, refresh: true };
function svgPosition(svg: SVGSVGElement, event: PointerEvent, size: number): Point {
  const rect = svg.getBoundingClientRect();
  return [(event.clientX - rect.left) * size / rect.width, (event.clientY - rect.top) * size / rect.height];
}
/** DOM adapter: one pointer per gesture, with live ink/hand position and capture. */
export function touchPointer(q: Question, state: TouchState,
  phase: 'down' | 'move' | 'up' | 'cancel', event: PointerEvent, svg: SVGSVGElement): TouchResult {
  if (!isTouchGame(q.gameId)) return { finished: false };
  const clock = q.gameId === 'clockhands', size = clock ? 200 : VIEW;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return { finished: false };
  if (phase === 'down') {
    if (state.pointerId !== null) return { finished: false };
    if (clock) {
      const target = event.target instanceof Element ? event.target.closest<SVGElement>('[data-clock-hand]') : null;
      const hand = target?.getAttribute('data-clock-hand');
      if (hand !== 'hour' && hand !== 'minute') return { finished: false };
      state.hand = hand;
    }
    const result = !clock ? traceRouteSample(q, state, 'down', svgPosition(svg, event, size)) :
      { finished: false };
    if (!clock && !state.drawing) return result;
    state.pointerId = event.pointerId;
    try { svg.setPointerCapture(event.pointerId); } catch { /* optional capture */ }
    return result;
  }
  if (state.pointerId !== event.pointerId) return { finished: false };
  if (phase === 'cancel') {
    state.pointerId = null; state.hand = null;
    return clock ? { finished: false, refresh: true } : traceRouteSample(q, state, 'cancel', [0,0]);
  }
  const p = svgPosition(svg, event, size);
  if (!clock) {
    const result = traceRouteSample(q, state, phase, p);
    if (!result.refresh && !result.finished) {
      const ink = svg.querySelector<SVGPolylineElement>('[data-touch-ink]');
      if (ink) ink.setAttribute('points', state.ink.map(pointString).join(' '));
    }
    if (phase === 'up' || result.refresh || result.finished) state.pointerId = null;
    return result;
  }
  if (!state.hand) return { finished: false };
  rotateClockHand(q, state, state.hand, p);
  const hour = svg.querySelector<SVGGElement>('[data-clock-rotation="hour"]');
  const minute = svg.querySelector<SVGGElement>('[data-clock-rotation="minute"]');
  hour?.setAttribute('transform', 'rotate(' + clockAngle(state.hour, state.minute) + ' 100 100)');
  minute?.setAttribute('transform', 'rotate(' + state.minute * 6 + ' 100 100)');
  const output = svg.parentElement?.querySelector<HTMLElement>('.clock-current');
  if (output) output.textContent = state.hour + ':' + String(state.minute).padStart(2, '0');
  if (phase === 'up') {
    state.hand = null; state.pointerId = null;
    return completedClock(q, state);
  }
  return { finished: false };
}
