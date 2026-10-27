import { MOVE_CARDS, isActivity } from './activity-content';
import { TRACE_GUIDES, strokePath, distanceToStroke, CORRIDOR_RADIUS, START_RADIUS, END_RADIUS } from './trace-guides';
import type { TraceGlyph, Point } from './trace-guides';
import type { Question } from './engine';

/** The only mutable runtime for non-choice games. No storage, scoring, timers or audio here. */
export interface ActivityState {
  id: string;
  count: number;
  usedTiles: number[];
  visited: Set<number>;
  strokes: string[];
  stroke: string[];
  drawing: boolean;
  pointerId: number | null;
  lastPoint: Point | null;
  distance: number;
  assisted: boolean;
  altIndex: number;
  altOpen: boolean;
  traceIndex: number;
  waypointIndex: number;
  feedback: string;
}
export type ActivityResult = { kind: 'progress' | 'submit'; value?: string; assisted?: boolean; skipped?: boolean; refresh?: boolean };
export function newActivityState(q: Question): ActivityState {
  return { id: q.id, count: 0, usedTiles: [], visited: new Set(), strokes: [], stroke: [],
    drawing: false, pointerId: null, lastPoint: null, distance: 0, assisted: false, altIndex: 0, altOpen: false, traceIndex: 0, waypointIndex: 0, feedback: '' };
}
const esc = (s: string): string => s.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function fiveFrame(total: number, filled: number): string {
  const groups = [];
  for (let start = 0; start < total; start += 5) {
    let dots = '';
    for (let j = start; j < Math.min(total, start + 5); j++)
      dots += '<span class="build-dot' + (j < filled ? ' filled' : '') + '"></span>';
    groups.push('<div class="build-group" aria-hidden="true">' + dots + '</div>');
  }
  return '<div class="build-groups">' + groups.join('') + '</div>';
}
function traceHtml(q: Question, state: ActivityState, disabled: boolean): string {
  const symbol = q.visual.symbol as TraceGlyph;
  const guide = TRACE_GUIDES[symbol];
  if (!guide) return '<p>ガイドが みつかりません。</p>';
  const activeStroke = guide.strokes[Math.min(state.traceIndex, guide.strokes.length - 1)];
  const current = state.traceIndex + 1, total = guide.strokes.length;
  const paths = guide.strokes.map((points, i) => {
    const color = i < state.traceIndex ? '#7bd7b4' : i === state.traceIndex ? '#e8bb70' : '#c8dafa';
    const start = points[0];
    return '<path d="' + strokePath(points) + '" fill="none" stroke="' + color +
      '" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + strokePath(points) + '" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="3 16"' +
      ' stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g class="stroke-number" aria-hidden="true"><circle cx="' + start[0] + '" cy="' + start[1] +
      '" r="16" fill="#5073b8" stroke="#fff" stroke-width="2"/>' +
      '<text x="' + start[0] + '" y="' + (start[1] + 5) + '" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">' +
      (i + 1) + '</text></g>';
  }).join('');
  const ink = state.strokes.map(points =>
    '<polyline points="' + points + '" fill="none" stroke="#38a993" stroke-width="16" ' +
    'stroke-linecap="round" stroke-linejoin="round"/>').join('');
  const nodes = activeStroke.map(([x, y], i) =>
    '<circle cx="' + x + '" cy="' + y + '" r="' + (i === state.waypointIndex ? 10 : 6) +
    '" fill="' + (i < state.waypointIndex ? '#32ac8e' : '#f5b548') +
    '" stroke="#fff" stroke-width="2"/>').join('');
  return '<div class="interactive trace-interactive"><div class="trace-stroke-count" role="status"><strong>' + guide.label +
    '</strong><span>' + total + 'かく　｜　いま ' + current + 'かくめ</span></div>' +
    '<div class="trace-board"><svg data-trace-board viewBox="0 0 240 240" aria-label="' + esc(guide.label) +
    'は ' + total + 'かく。' + current + 'かくめの きいろい みちを なぞろう" role="img">' +
    paths + '<g data-ink>' + ink + '</g><g data-guide-nodes>' + nodes + '</g></svg></div>' +
    '<p class="activity-counter" aria-label="つぎの てん">' + Math.min(activeStroke.length, state.waypointIndex + 1) +
    '/' + activeStroke.length + '</p>' +
    '<button type="button" class="activity-undo" data-activity="trace-reset"' +
    (disabled ? ' disabled' : '') + '>↻ はじめから</button>' +
    '</div>';
}
function blocksHtml(q: Question, state: ActivityState, disabled: boolean): string {
  const target = q.visual.a ?? 10;
  return '<div class="interactive blocks-interactive"><div class="build-status"><span>🎯 もくひょう ' +
    target + 'こ</span><strong>' + state.count + ' / ' + target + '</strong></div>' +
    '<button type="button" class="build-tap-back" data-activity="block-back" aria-label="おいた ブロックを 1こ もどす"' +
    (disabled || state.count === 0 ? ' disabled' : '') + '>' + fiveFrame(target, state.count) + '</button>' +
    '<div class="activity-controls"><button type="button" data-activity="block-one"' + (disabled ? ' disabled' : '') +
    '>🟡 +1こ</button><button type="button" data-activity="block-five"' + (disabled ? ' disabled' : '') +
    '>🧱 +5こ</button></div>' +
    '<div class="machine" aria-hidden="true">' + (state.count >= target ? '⚙️✨' : '⚙️🔧') + '</div></div>';
}
function trainHtml(q: Question, state: ActivityState, disabled: boolean): string {
  const letters = q.visual.preview ?? [];
  const made = state.usedTiles.map(i => letters[i]).join('');
  const slots = Array.from({ length: Array.from(q.answer).length }, (_, i) =>
    (i < state.usedTiles.length ?
      '<button type="button" class="train-slot placed" data-activity="train-remove" data-index="' + i +
      '" aria-label="' + esc(letters[state.usedTiles[i]]) + ' を もどす"' +
      (disabled ? ' disabled' : '') + '>' + esc(letters[state.usedTiles[i]]) + '</button>' :
      '<span class="train-slot">・</span>')).join('');
  const tiles = letters.map((letter, i) => '<button type="button" class="train-tile" data-activity="train-tile" ' +
    'data-index="' + i + '"' + (disabled || state.usedTiles.includes(i) ? ' disabled' : '') +
    ' aria-label="もじ ' + esc(letter) + ' を つなぐ">' + esc(letter) + '</button>').join('');
  return '<div class="interactive train-interactive"><div class="train-mascot" aria-hidden="true">' +
    esc(q.visual.symbol ?? '🚂') + '</div>' +    '<div class="train-slots" aria-label="いま つくった ことば ' + esc(made) + '">' + slots + '</div>' +
    '<div class="train-track" aria-hidden="true">━━━━━━━━━━━━━━</div>' +
    '<div class="train-tiles">' + tiles + '</div></div>';
}
function moveHtml(q: Question, disabled: boolean): string {
  const card = MOVE_CARDS[q.visual.a ?? 0] ?? MOVE_CARDS[0];
  return '<div class="interactive move-interactive"><span class="move-icon" aria-hidden="true">' +
    card.emoji + '</span><p class="move-name">' + esc(card.name) + '</p>' +
    '<p class="move-instructions">' + esc(card.instruction) + '</p>' +
    '<p class="move-seated">🪑 ' + esc(card.seated) + '</p>' +
    '<p class="move-safety">いたいときは やめよう。みるだけでも いいよ。</p>' +
    '<details class="move-parent-note"><summary>ほごしゃの かたへ</summary>' +
    '<p>安全な場所で無理なく。撮影や姿勢の採点はありません。</p></details>' +
    '<div class="move-buttons"><button type="button" class="move-done" data-activity="move-done"' +
    (disabled ? ' disabled' : '') + '>🌟 やってみた！</button>' +
    '<button type="button" class="move-skip" data-activity="move-skip"' +
    (disabled ? ' disabled' : '') + '>🌱 みたよ・おやすみ</button></div></div>';
}
export function activityHtml(q: Question, state: ActivityState, disabled = false): string {
  if (!isActivity(q.gameId)) return '';
  const content = q.gameId === 'trace' || q.gameId === 'lines' || q.gameId === 'digits' ? traceHtml(q, state, disabled) :
    q.gameId === 'blocks' ? blocksHtml(q, state, disabled) :
    q.gameId === 'train' ? trainHtml(q, state, disabled) : moveHtml(q, disabled);
  return content + (state.feedback ? '<p class="activity-message" role="status">' + esc(state.feedback) + '</p>' : '');
}

export function activityClick(q: Question, state: ActivityState, action: string, index: number): ActivityResult {
  if (q.gameId === 'blocks') {
    const target = q.visual.a ?? 10;
    if (action === 'block-one' || action === 'block-five') {
      const amount = action === 'block-one' ? 1 : 5;
      if (state.count + amount > target) {
        state.feedback = 'おっと！ もくひょうより おおいよ。いくつ たりないかな？';
        return { kind: 'progress' };
      }
      state.count += amount;
      state.feedback = '';
      return state.count === target ? { kind: 'submit', value: String(target) } : { kind: 'progress' };
    }
    if (action === 'block-back') { state.count = Math.max(0, state.count - 1); state.feedback = ''; }
  } else if (q.gameId === 'train') {
    const chars = q.visual.preview ?? [];
    if (action === 'train-tile' && Number.isInteger(index) && index >= 0 && index < chars.length &&
        !state.usedTiles.includes(index)) {
      state.usedTiles.push(index);
      if (state.usedTiles.length === Array.from(q.answer).length) {
        const word = state.usedTiles.map(i => chars[i]).join('');
        if (word === q.answer) return { kind: 'submit', value: word };
        state.usedTiles = [];
        state.feedback = 'おしい！ もじの じゅんばんを かえてみよう。';
        return { kind: 'submit', value: word };
      }
      state.feedback = '';
    }
    if (action === 'train-remove' && Number.isInteger(index) && index >= 0 &&
      index < state.usedTiles.length) {
      state.usedTiles.splice(index, 1);
      state.feedback = '';
    }
  } else if (q.gameId === 'trace' || q.gameId === 'lines' || q.gameId === 'digits') {
    const guide = TRACE_GUIDES[q.visual.symbol ?? ''];
    if (!guide) return { kind: 'progress' };
    if (action === 'trace-reset') {
      state.traceIndex = 0; state.waypointIndex = 0; state.altIndex = 0;
      state.visited.clear(); state.strokes = []; state.stroke = []; state.distance = 0;
      state.drawing = false; state.pointerId = null; state.lastPoint = null;
      state.altOpen = false; state.assisted = false; state.feedback = '';
    }

  } else if (q.gameId === 'move') {
    if (action === 'move-done') return { kind: 'submit', value: q.answer, assisted: true };
    if (action === 'move-skip') return { kind: 'submit', value: q.answer, assisted: true, skipped: true };
  }
  return { kind: 'progress' };
}

/** Completing a stroke advances to the next stroke; no guessing-based score. */
function finishTraceStroke(q: Question, state: ActivityState): ActivityResult {
  const guide = TRACE_GUIDES[q.visual.symbol ?? ''];
  if (!guide) return { kind: 'progress' };
  if (state.stroke.length > 1) state.strokes.push(state.stroke.join(' '));
  state.stroke = []; state.drawing = false; state.pointerId = null; state.lastPoint = null;
  state.traceIndex++; state.waypointIndex = 0; state.altIndex = 0;
  state.visited.clear();
  if (state.traceIndex === guide.strokes.length)
    return { kind: 'submit', value: q.answer, assisted: true };
  state.feedback = 'いいね！ つぎは ' + (state.traceIndex + 1) + 'かくめ！';
  return { kind: 'progress', refresh: true };
}
function rejectCurrentStroke(state: ActivityState): ActivityResult {
  state.stroke = []; state.drawing = false; state.pointerId = null; state.lastPoint = null;
  state.waypointIndex = 0; state.altIndex = 0; state.visited.clear();
  state.feedback = 'わくから でちゃった！ この 1かくだけ もういちど。';
  return { kind: 'progress', refresh: true };
}
/** Pure, geometry-based input; only ordered waypoints within the path corridor count. */
export function traceSample(q: Question, state: ActivityState,
  phase: 'down' | 'move' | 'up' | 'cancel', pos: Point, touchAllowance = 0): ActivityResult {
  if (q.gameId !== 'trace' && q.gameId !== 'lines' && q.gameId !== 'digits') return { kind: 'progress' };
  const stroke = TRACE_GUIDES[q.visual.symbol ?? '']?.strokes[state.traceIndex];
  if (!stroke) return { kind: 'progress' };
  if (phase === 'cancel') return rejectCurrentStroke(state);
  if (phase === 'down') {
    if (state.drawing) return { kind: 'progress' };
    if (Math.hypot(pos[0] - stroke[0][0], pos[1] - stroke[0][1]) > START_RADIUS) {
      state.feedback = 'あおい 1ばんの まるから スタートしてね！';
      return { kind: 'progress', refresh: true };
    }
    state.drawing = true; state.stroke = []; state.waypointIndex = 0;
    state.visited.clear(); state.lastPoint = pos; state.feedback = '';
  }
  if (!state.drawing) return { kind: 'progress' };
  const old = state.lastPoint ?? pos;
  const distance = Math.hypot(pos[0] - old[0], pos[1] - old[1]);
  const hops = Math.max(1, Math.ceil(distance / 5));
  for (let step = 0; step <= hops; step++) {
    const point: Point = [old[0] + (pos[0] - old[0]) * step / hops,
      old[1] + (pos[1] - old[1]) * step / hops];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
      distanceToStroke(point, stroke) > CORRIDOR_RADIUS + Math.min(2, Math.max(0, touchAllowance)))
      return rejectCurrentStroke(state);
    const next = stroke[state.waypointIndex];
    if (next && Math.hypot(next[0] - point[0], next[1] - point[1]) <= START_RADIUS) {
      state.visited.add(state.waypointIndex); state.waypointIndex++;
    }
  }
  state.stroke.push(pos.map(x => x.toFixed(1)).join(','));
  state.lastPoint = pos;
  state.distance += Math.min(distance, 50);
  if (phase === 'up') {
    const end = stroke[stroke.length - 1];
    if (state.waypointIndex === stroke.length &&
      Math.hypot(end[0] - pos[0], end[1] - pos[1]) <= END_RADIUS) {
      return finishTraceStroke(q, state);
    }
    state.stroke = []; state.drawing = false; state.pointerId = null; state.lastPoint = null;
    state.waypointIndex = 0; state.visited.clear();
    state.feedback = 'おしい！ さいごまで ひとふでで なぞってみよう。';
    return { kind: 'progress', refresh: true };
  }
  return { kind: 'progress' };
}
/** The SVG coordinate adapter owns DOM only, while geometry and order are unit-testable. */
export function tracePointer(q: Question, state: ActivityState,
  phase: 'down' | 'move' | 'up' | 'cancel', event: PointerEvent, svg: SVGSVGElement): ActivityResult {
  if (q.gameId !== 'trace' && q.gameId !== 'lines' && q.gameId !== 'digits') return { kind: 'progress' };
  if (phase === 'down') {
    if (state.drawing) return { kind: 'progress' };
    state.pointerId = event.pointerId;
    try { svg.setPointerCapture(event.pointerId); } catch { /* optional */ }
  } else if (state.pointerId !== event.pointerId) return { kind: 'progress' };
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { kind: 'progress' };
  const position: Point = [(event.clientX - rect.left) * 240 / rect.width,
    (event.clientY - rect.top) * 240 / rect.height];
  const result = traceSample(q, state, phase, position, event.pointerType === 'touch' ? 2 : 0);
  if ((phase === 'down' || phase === 'move') && state.drawing) {
    const ink = svg.querySelector<SVGGElement>('[data-ink]');
    if (ink) {
      let current = ink.querySelector<SVGPolylineElement>('[data-current]');
      if (!current) {
        current = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        current.setAttribute('data-current', '');
        current.setAttribute('fill', 'none');
        current.setAttribute('stroke', '#38a993');
        current.setAttribute('stroke-width', '16');
        current.setAttribute('stroke-linecap', 'round');
        current.setAttribute('stroke-linejoin', 'round');
        ink.appendChild(current);
      }
      current.setAttribute('points', state.stroke.join(' '));
    }
  }
  return result;
}
