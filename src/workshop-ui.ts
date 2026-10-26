import type { Question } from './engine';
import { isWorkshop } from './workshop-content';

export interface WorkshopState {
  coins: number[];
  sequence: number[];
  left: number;
  right: number;
  beats: string[];
  message: string;
}
export interface WorkshopResult { finished: boolean; value?: string; practice?: boolean }
export const freshWorkshop = (): WorkshopState => ({
  coins: [], sequence: [], left: 0, right: 0, beats: [], message: ''
});
const money = (coins: number[]) => coins.reduce((a, b) => a + b, 0);
const escape = (value: string): string => value.replace(/[&<>"']/g, x =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x] ?? x);
const btn = (action: string, label: string, disabled: boolean, index?: number): string =>
  '<button type="button" class="workshop-btn" data-workshop="' + action + '"' +
  (index === undefined ? '' : ' data-index="' + index + '"') +
  (disabled ? ' disabled' : '') + '>' + escape(label) + '</button>';
export function workshopHtml(q: Question, state: WorkshopState, disabled: boolean): string {
  if (!isWorkshop(q.gameId)) return '';
  const message = '<p class="workshop-message" aria-live="polite">' + escape(state.message) + '</p>';
  if (q.gameId === 'shop') {
    const target = q.visual.a ?? 0, current = money(state.coins);
    const coins = [1, 5, 10].map(v =>
      btn('coin', v + 'えん', disabled || current + v > target, v)).join('');
    const placed = state.coins.map((v, index) =>
      '<button type="button" class="coin-token" data-workshop="remove-coin" data-index="' + index +
      '" aria-label="' + v + 'えんを もどす"' + (disabled ? ' disabled' : '') +
      '>' + v + '<small>えん</small></button>').join('');
    return '<div class="workshop workshop-shop">' +
      '<div class="shop-money" role="status">あと <strong>' + (target - current) + '</strong> えん</div>' +
      '<div class="shop-coins" role="group" aria-label="いれた おかね。おすと もどる">' +
      (placed || '<span class="shop-empty">ここに おかねを いれよう</span>') + '</div>' +
      '<div class="workshop-actions">' + coins + '</div>' + message + '</div>';
  }
  if (q.gameId === 'routine') {
    const labels = q.visual.preview ?? [];
    const arranged = state.sequence.map(i => labels[i]);
    return '<div class="workshop"><div class="routine-order">' +
      Array.from({ length: labels.length }, (_, i) =>
        '<span class="routine-step">' + (arranged[i] ? escape(arranged[i]) : '❔ ' + (i + 1)) + '</span>').join('') +
      '</div><p class="workshop-hint">つぎに することを タップ！</p><div class="routine-options">' +
      labels.map((s, i) => btn('routine', s, disabled || state.sequence.includes(i), i)).join('') +
      '</div>' + btn('undo', '↩ ひとつ もどす', disabled || !state.sequence.length) + message + '</div>';
  }
  if (q.gameId === 'split') {
    const leftTarget = q.visual.a ?? 0, rightTarget = q.visual.b ?? 0;
    const total = leftTarget + rightTarget, remaining = total - state.left - state.right;
    return '<div class="workshop"><div class="split-baskets">' +
      '<div class="split-basket"><strong>🔴 ' + leftTarget + 'こ の はこ</strong>' +
      '<div class="split-dots">' + '🔴'.repeat(state.left) + '</div><b>' + state.left + '/' + leftTarget + '</b>' +
      btn('left', '＋1こ', disabled || !remaining) +
      btn('left-five', '＋5こ', disabled || remaining < 5 || state.left + 5 > leftTarget) +
      btn('left-undo', '↩ もどす', disabled || !state.left) + '</div>' +
      '<div class="split-basket"><strong>🔵 ' + rightTarget + 'こ の はこ</strong>' +
      '<div class="split-dots">' + '🔵'.repeat(state.right) + '</div><b>' + state.right + '/' + rightTarget + '</b>' +
      btn('right', '＋1こ', disabled || !remaining) +
      btn('right-five', '＋5こ', disabled || remaining < 5 || state.right + 5 > rightTarget) +
      btn('right-undo', '↩ もどす', disabled || !state.right) + '</div></div>' +
      '<p class="workshop-hint">あと ' + remaining + 'こ のこっているよ</p>' + message + '</div>';
  }
  const pattern = q.visual.preview ?? [];
  return '<div class="workshop"><p class="workshop-hint">うえの じゅんばんで たたいてみよう！</p>' +
    '<div class="rhythm-score">' + pattern.map((beat, i) =>
      '<span class="' + (i < state.beats.length ? 'played' : '') + '">' + escape(beat) + '</span>').join('') +
    '</div><div class="rhythm-pads">' + btn('beat', '🔵 あお', disabled, 0) +
    btn('beat', '🟠 オレンジ', disabled, 1) + '</div>' +
    '<p class="workshop-hint">' + state.beats.length + '/' + pattern.length + ' はく</p>' + message + '</div>';
}
/** Only successful construction submits an answer; random taps do not award progress. */
export function workshopClick(q: Question, state: WorkshopState, action: string, index = -1): WorkshopResult {
  if (!isWorkshop(q.gameId)) return { finished: false };
  if (q.gameId === 'shop') {
    if (action === 'remove-coin') {
      if (index >= 0 && index < state.coins.length && Number.isInteger(index)) {
        state.coins.splice(index, 1);
        state.message = '';
      }
      return { finished: false };
    }
    const target = q.visual.a ?? 0;
    if (action !== 'coin' || ![1, 5, 10].includes(index)) return { finished: false };
    const current = money(state.coins);
    if (current + index > target) return { finished: false };
    state.coins.push(index);
    state.message = '';
    return money(state.coins) === target ? { finished: true, value: q.answer } : { finished: false };
  }
  if (action === 'undo' && q.gameId === 'routine') {
    state.sequence.pop();
    state.message = '';
    return { finished: false };
  }
  if (q.gameId === 'routine') {
    const labels = q.visual.preview ?? [];
    if (action !== 'routine' || index < 0 || index >= labels.length || state.sequence.includes(index))
      return { finished: false };
    state.sequence.push(index);
    if (state.sequence.length === labels.length) {
      if (state.sequence.map(i => labels[i]).join('|') === q.answer)
        return { finished: true, value: q.answer, practice: true };
      state.sequence = [];
      state.message = 'ほかの じゅんばんも ためそう。';
    } else state.message = '';
    return { finished: false };
  }
  if (q.gameId === 'split') {
    const left = q.visual.a ?? 0, right = q.visual.b ?? 0, total = left + right;
    if (action === 'left-undo') state.left = Math.max(0, state.left - 1);
    else if (action === 'right-undo') state.right = Math.max(0, state.right - 1);
    else if (action === 'left-five' && state.left + 5 <= left && state.left + state.right + 5 <= total)
      state.left += 5;
    else if (action === 'right-five' && state.right + 5 <= right && state.left + state.right + 5 <= total)
      state.right += 5;
    else if (action === 'left' && state.left + state.right < total) state.left++;
    else if (action === 'right' && state.left + state.right < total) state.right++;
    else return { finished: false };
    state.message = state.left + state.right === total && (state.left !== left || state.right !== right) ?
      'かずが ちがうみたい。1こ もどしてみよう！' : '';
    return state.left === left && state.right === right ?
      { finished: true, value: q.answer } : { finished: false };
  }
  if (action !== 'beat' || (index !== 0 && index !== 1)) return { finished: false };
  const pattern = q.visual.preview ?? [];
  const beat = index === 0 ? '🔵' : '🟠';
  if (beat !== pattern[state.beats.length]) {
    state.beats = [];
    state.message = 'もういちど ゆっくり やってみよう！';
    return { finished: false };
  }
  state.message = '';
  state.beats.push(beat);
  return state.beats.length === pattern.length ?
    { finished: true, value: q.answer, practice: true } : { finished: false };
}
