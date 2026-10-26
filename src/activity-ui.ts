import { TRACE_GUIDES, MOVE_CARDS, isActivity } from './activity-content';
import type { TraceGlyph } from './activity-content';
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
  lastPoint: [number, number] | null;
  distance: number;
  assisted: boolean;
  altIndex: number;
  altOpen: boolean;
  feedback: string;
}
export type ActivityResult = { kind: 'progress' | 'submit'; value?: string; assisted?: boolean; skipped?: boolean };
export function newActivityState(q: Question): ActivityState {
  return { id: q.id, count: 0, usedTiles: [], visited: new Set(), strokes: [], stroke: [],
    drawing: false, pointerId: null, lastPoint: null, distance: 0, assisted: false, altIndex: 0, altOpen: false, feedback: '' };
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
  if (!guide) return '<p>なぞる もじが みつかりません。</p>';
  const path = state.strokes.map(points => '<polyline points="' + points +
    '" fill="none" stroke="#4db89f" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>').join('');
  const nodes = guide.points.map(([x, y], i) =>
    '<circle cx="' + x + '" cy="' + y + '" r="7" fill="' + (state.visited.has(i) ? '#2ead99' : '#f5b548') +
    '" stroke="#fff" stroke-width="2"/>').join('');
  const total = guide.points.length;
  const reached = state.visited.size;
  const alt = guide.points.map((_, i) =>
    '<button type="button" data-activity="trace-point" data-index="' + i + '"' + (disabled ? ' disabled' : '') +
    ' aria-label="' + (i + 1) + 'ばんめの てんを たどる" class="trace-step' +
    (state.visited.has(i) ? ' reached' : '') + '">' + (i + 1) + '</button>').join('');
  return '<div class="interactive trace-interactive"><p class="activity-instructions">みちを ゆびで なぞろう。' +
    'きれいに かけなくても だいじょうぶ！</p>' +
    '<div class="trace-board"><svg data-trace-board viewBox="0 0 240 240" aria-label="' + esc(symbol) +
    'の なぞりがき。ゆびで きいろの てんを つなごう" role="img">' +
    '<path d="' + guide.path + '" fill="none" stroke="#c8dafa" stroke-width="37" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' + guide.path + '" fill="none" stroke="#fff" stroke-width="13" stroke-dasharray="3 18" stroke-linecap="round"/>' +
    '<g data-ink>' + path + '</g><g data-guide-nodes>' + nodes + '</g></svg></div>' +
    '<p class="activity-counter" role="status">てんを たどったよ：' + reached + '/' + total + '</p>' +
    '<button type="button" class="activity-undo" data-activity="trace-reset"' + (disabled ? ' disabled' : '') +
    '>↻ もういちど なぞる</button>' +
    '<details class="trace-access"' + (state.altOpen ? ' open' : '') + '><summary>ゆびで かくのが むずかしいとき</summary>' +
    '<p>てんを ばんごうじゅんに おしても れんしゅうできるよ。</p>' +
    '<div class="trace-steps">' + alt + '</div></details></div>';
}
function blocksHtml(q: Question, state: ActivityState, disabled: boolean): string {
  const target = q.visual.a ?? 10;
  return '<div class="interactive blocks-interactive"><div class="build-status"><span>🎯 もくひょう ' +
    target + 'こ</span><strong>' + state.count + ' / ' + target + '</strong></div>' +
    fiveFrame(target, state.count) +
    '<p class="activity-instructions">1こずつ、または 5こまとめて ブロックを いれよう。</p>' +
    '<div class="activity-controls"><button type="button" data-activity="block-one"' + (disabled ? ' disabled' : '') +
    '>🟡 +1こ</button><button type="button" data-activity="block-five"' + (disabled ? ' disabled' : '') +
    '>🧱 +5こ</button><button type="button" data-activity="block-back"' + (disabled || state.count === 0 ? ' disabled' : '') +
    '>↩ 1こ もどす</button></div>' +
    '<div class="machine" aria-hidden="true">' + (state.count >= target ? '⚙️✨' : '⚙️🔧') + '</div></div>';
}
function trainHtml(q: Question, state: ActivityState, disabled: boolean): string {
  const letters = q.visual.preview ?? [];
  const made = state.usedTiles.map(i => letters[i]).join('');
  const slots = Array.from({ length: Array.from(q.answer).length }, (_, i) =>
    '<span class="train-slot' + (i < state.usedTiles.length ? ' placed' : '') + '">' +
    (i < state.usedTiles.length ? esc(letters[state.usedTiles[i]]) : '・') + '</span>').join('');
  const tiles = letters.map((letter, i) => '<button type="button" class="train-tile" data-activity="train-tile" ' +
    'data-index="' + i + '"' + (disabled || state.usedTiles.includes(i) ? ' disabled' : '') +
    ' aria-label="もじ ' + esc(letter) + ' を つなぐ">' + esc(letter) + '</button>').join('');
  return '<div class="interactive train-interactive"><div class="train-mascot" aria-hidden="true">' +
    esc(q.visual.symbol ?? '🚂') + '</div><p class="activity-instructions">もじを おして、れっしゃを つなごう！</p>' +
    '<div class="train-slots" aria-label="いま つくった ことば ' + esc(made) + '">' + slots + '</div>' +
    '<div class="train-track" aria-hidden="true">━━━━━━━━━━━━━━</div>' +
    '<div class="train-tiles">' + tiles + '</div>' +
    '<button type="button" class="activity-undo" data-activity="train-back"' +
    (disabled || state.usedTiles.length === 0 ? ' disabled' : '') + '>↩ ひとつ もどす</button></div>';
}
function moveHtml(q: Question, disabled: boolean): string {
  const card = MOVE_CARDS[q.visual.a ?? 0] ?? MOVE_CARDS[0];
  return '<div class="interactive move-interactive"><span class="move-icon" aria-hidden="true">' +
    card.emoji + '</span><p class="move-name">' + esc(card.name) + '</p>' +
    '<p class="move-instructions">' + esc(card.instruction) + '</p>' +
    '<p class="move-seated">🪑 ' + esc(card.seated) + '</p>' +
    '<p class="move-safety">あぶない ものが ない ところでね。いたい・つらいときは やめよう。' +
    'みるだけでも いいよ。カメラは つかわないよ。</p>' +
    '<div class="move-buttons"><button type="button" class="move-done" data-activity="move-done"' +
    (disabled ? ' disabled' : '') + '>🌟 やってみた！</button>' +
    '<button type="button" class="move-skip" data-activity="move-skip"' +
    (disabled ? ' disabled' : '') + '>🌱 みたよ・おやすみ</button></div></div>';
}
export function activityHtml(q: Question, state: ActivityState, disabled = false): string {
  if (!isActivity(q.gameId)) return '';
  const content = q.gameId === 'trace' ? traceHtml(q, state, disabled) :
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
    if (action === 'train-back') { state.usedTiles.pop(); state.feedback = ''; }
  } else if (q.gameId === 'trace') {
    if (action === 'trace-reset') {
      state.visited.clear(); state.strokes = []; state.stroke = []; state.distance = 0;
      state.assisted = false; state.altIndex = 0; state.altOpen = false; state.feedback = '';
    } else if (action === 'trace-point') {
      const symbol = q.visual.symbol as TraceGlyph;
      const guide = TRACE_GUIDES[symbol];
      if (guide && index === state.altIndex) {
        state.visited.add(index); state.altIndex++; state.altOpen = true; state.assisted = true;
        state.feedback = 'てんを じゅんばんに たどろう！';
        if (state.altIndex === guide.points.length)
          return { kind: 'submit', value: q.answer, assisted: true };
      }
    }
  } else if (q.gameId === 'move') {
    if (action === 'move-done') return { kind: 'submit', value: q.answer, assisted: true };
    if (action === 'move-skip') return { kind: 'submit', value: q.answer, assisted: true, skipped: true };
  }
  return { kind: 'progress' };
}

/** A stroke is sampled in SVG coordinates. Nearby waypoints (not exact calligraphy) count as practice. */
export function tracePointer(q: Question, state: ActivityState, phase: string, event: PointerEvent,
                             svg: SVGSVGElement): ActivityResult {
  if (q.gameId !== 'trace' || !TRACE_GUIDES[q.visual.symbol as TraceGlyph]) return { kind: 'progress' };
  const guide = TRACE_GUIDES[q.visual.symbol as TraceGlyph];
  if (phase === 'down') {
    if (state.drawing) return { kind: 'progress' };
    state.drawing = true; state.pointerId = event.pointerId; state.lastPoint = null;
    state.stroke = [];
    try { svg.setPointerCapture(event.pointerId); } catch { /* optional */ }
  }
  if (!state.drawing || state.pointerId !== event.pointerId) return { kind: 'progress' };
  const rect = svg.getBoundingClientRect();
  const pos: [number, number] = [
    Math.max(0, Math.min(240, (event.clientX - rect.left) * 240 / rect.width)),
    Math.max(0, Math.min(240, (event.clientY - rect.top) * 240 / rect.height))
  ];
  const old = state.lastPoint ?? pos;
  const distance = Math.hypot(pos[0] - old[0], pos[1] - old[1]);
  if (phase !== 'cancel' && state.stroke.length < 420) {
    const hops = Math.max(1, Math.ceil(distance / 8));
    for (let step = 1; step <= hops; step++) {
      const x = old[0] + (pos[0] - old[0]) * step / hops;
      const y = old[1] + (pos[1] - old[1]) * step / hops;
      guide.points.forEach(([px, py], i) => {
        if (Math.hypot(px - x, py - y) <= 27) state.visited.add(i);
      });
    }
    state.stroke.push(pos.map(x => x.toFixed(1)).join(','));
    state.distance += Math.min(distance, 40);
    state.lastPoint = pos;
    const ink = svg.querySelector<SVGGElement>('[data-ink]');
    if (ink) {
      let current = ink.querySelector<SVGPolylineElement>('[data-current]');
      if (!current) {
        current = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        current.setAttribute('data-current', '');
        current.setAttribute('fill', 'none');
        current.setAttribute('stroke', '#4db89f');
        current.setAttribute('stroke-width', '15');
        current.setAttribute('stroke-linecap', 'round');
        current.setAttribute('stroke-linejoin', 'round');
        ink.appendChild(current);
      }
      current.setAttribute('points', state.stroke.join(' '));
    }
  }
  if (phase === 'up' || phase === 'cancel') {
    state.drawing = false; state.pointerId = null; state.lastPoint = null;
    if (phase === 'up' && state.stroke.length > 1) state.strokes.push(state.stroke.join(' '));
    state.stroke = [];
    if (state.visited.size >= Math.ceil(guide.points.length * 0.75) && state.distance >= 70)
      return { kind: 'submit', value: q.answer, assisted: true };
    state.feedback = 'いいかんじ！ きいろの てんを もっと なぞろう。';
  }
  return { kind: 'progress' };
}
