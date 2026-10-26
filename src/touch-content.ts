import type { GameId, Question } from './engine';
export type TouchGame = Extract<GameId, 'connect' | 'maze' | 'clockhands'>;
export const isTouchGame = (id: GameId): id is TouchGame =>
  id === 'connect' || id === 'maze' || id === 'clockhands';

const maze3 = [0, 1, 4, 3, 6, 7, 8] as const;
const maze4 = [0, 1, 2, 6, 5, 9, 10, 11, 15] as const;
function rotate(cell: number, n: number, turns: number): number {
  let row = Math.floor(cell / n), col = cell % n;
  for (let t = 0; t < turns; t++) [row, col] = [col, n - 1 - row];
  return row * n + col;
}
export function mazePath(i: number, level: number): { size: number; path: number[] } {
  const size = level < 3 ? 3 : 4;
  const route = size === 3 ? maze3 : maze4;
  const turns = i % 4;
  return { size, path: route.map(cell => rotate(cell, size, turns)) };
}
/** Roads include the hidden solution plus optional dead ends; the solution is never drawn. */
export function mazeRoads(path: readonly number[], size: number, index: number, level: number): string[] {
  const roads = path.slice(1).map((cell, i) => path[i] + ':' + cell);
  const occupied = new Set(path);
  const branchCount = Math.min(size * size - path.length, level <= 2 ? level : level - 1);
  const candidates = Array.from({ length: size * size }, (_, cell) => cell)
    .filter(cell => !occupied.has(cell))
    .map(cell => ({
      cell,
      parent: path.find(other => Math.abs(Math.floor(other / size) - Math.floor(cell / size)) +
        Math.abs(other % size - cell % size) === 1)
    }))
    .filter((candidate): candidate is { cell: number; parent: number } => candidate.parent !== undefined)
    .sort((a, b) => {
      const ka = (a.cell * 7 + index * 3) % (size * size);
      const kb = (b.cell * 7 + index * 3) % (size * size);
      return ka - kb || a.cell - b.cell;
    });
  for (const candidate of candidates.slice(0, branchCount))
    roads.push(candidate.parent + ':' + candidate.cell);
  return roads;
}
export function makeTouchQuestion(gameId: TouchGame, index: number, level: number): Question {
  const id = gameId + (level > 1 ? ':L' + level : '') + ':' + index;
  if (gameId === 'connect') {
    const n = Math.min(10, 3 + level + index % 3);
    return { id, gameId, prompt: '1から じゅんに せんを なぞろう！',
      visual: { kind: 'connect', a: n, b: index % 4 }, choices: [String(n), 'まだ'], answer: String(n),
      explanation: '1から ' + n + 'まで つながったね！' };
  }
  if (gameId === 'maze') {
    const { size, path } = mazePath(index, level);
    return { id, gameId, prompt: '🚂から ⭐へ いこう！',
      visual: { kind: 'maze', a: size, numbers: path, preview: mazeRoads(path, size, index, level) }, choices: ['ゴール', 'もういちど'], answer: 'ゴール',
      explanation: 'みちを みつけたね！' };
  }
  const step = level === 1 ? 30 : level === 2 ? 15 : 5;
  const hour = (index % 12) + 1;
  const minute = Math.floor(index / 12) * step % 60;
  const suffix = minute === 0 ? '' : minute === 30 ? 'はん' : minute + 'ふん';
  const answer = hour + 'じ' + suffix;
  return { id, gameId, prompt: answer + 'の とけいを つくろう！',
    visual: { kind: 'clockhands', hour, minute, step }, choices: [answer, 'ちがう じかん'],
    answer, explanation: answer + 'が つくれたね！' };
}
