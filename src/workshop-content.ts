import type { GameId, Question } from './engine';

export type WorkshopGame = Extract<GameId, 'shop' | 'routine' | 'split' | 'rhythm'>;
export const isWorkshop = (id: GameId): id is WorkshopGame =>
  id === 'shop' || id === 'routine' || id === 'split' || id === 'rhythm';

const ROUTINES = [
  { title: 'おでかけの じゅんび', steps: ['おきる', 'ふくを きる', 'くつを はく', 'でかける'], icons: ['🌞', '👕', '👟', '🚶'] },
  { title: 'てを きれいに', steps: ['みずで ぬらす', 'せっけんで あらう', 'みずで ながす', 'タオルで ふく'], icons: ['💧', '🫧', '🚰', '🧻'] },
  { title: 'しょくぶつを そだてよう', steps: ['たねを まく', 'みずを あげる', 'めが でる', 'はなが さく'], icons: ['🌰', '🚿', '🌱', '🌼'] },
  { title: 'おべんとうを つくろう', steps: ['てを あらう', 'おかずを つめる', 'ふたを しめる', 'もって でかける'], icons: ['🫧', '🍙', '🍱', '🎒'] }
] as const;
export function makeWorkshopQuestion(id: WorkshopGame, index: number, level: number): Question {
  const qid = id + (level > 1 ? ':L' + level : '') + ':' + index;
  if (id === 'shop') {
    const target = level === 1 ? (index % 9) + 1 : level === 2 ? (index % 11) + 5 :
      level === 3 ? (index % 11) + 10 : level === 4 ? (index % 15) + 6 : (index * 7 % 20) + 1;
    return { id: qid, gameId: id, prompt: target + 'えんを つくろう！',
      visual: { kind: 'shop', a: target, symbol: ['🍎', '🍌', '🚂', '🧸'][index % 4] },
      answer: String(target), choices: [String(target), 'やりなおし'],
      explanation: 'ぴったり ' + target + 'えんに なったね！' };
  }
  if (id === 'routine') {
    const scenario = ROUTINES[(index + level - 1) % ROUTINES.length];
    const length = level <= 2 ? 3 : 4;
    const steps = scenario.steps.slice(0, length);
    const icons = scenario.icons.slice(0, length);
    const order = Array.from({ length }, (_, i) => i);
    // Use rotations + reversal to avoid displaying the correct order by chance.
    const offset = (index % (length - 1)) + 1;
    const shuffled = order.map((_, i) => order[(i + offset) % length]).reverse();
    const labels = shuffled.map(n => icons[n] + ' ' + steps[n]);
    const answer = steps.map((x, i) => icons[i] + ' ' + x).join('|');
    return { id: qid, gameId: id, prompt: scenario.title + '。じゅんに ならべよう！',
      visual: { kind: 'routine', preview: labels }, answer, choices: [answer, 'やりなおし'],
      explanation: 'ひとつずつ じゅんばんに できたね！' };
  }
  if (id === 'split') {
    const total = level < 3 ? 10 : level < 5 ? 15 : 20;
    const left = (index * 3 + level) % (total - 1) + 1;
    const answer = left + 'と' + (total - left);
    return { id: qid, gameId: id, prompt: total + 'この いしを ' + left + 'こと ' +
      (total - left) + 'こに わけよう！',
      visual: { kind: 'split', a: left, b: total - left }, answer, choices: [answer, 'やりなおし'],
      explanation: left + 'こと ' + (total - left) + 'こで ' + total + 'こ！' };
  }
  const length = Math.min(6, 3 + Math.floor(level / 2));
  const beats = Array.from({ length }, (_, i) =>
    (Math.floor(index / 3) + index * 3 + i * 5 + (i * i) + level) % 3 === 0 ? '🔵' : '🟠');
  if (!beats.includes('🔵')) beats[0] = '🔵';
  if (!beats.includes('🟠')) beats[length - 1] = '🟠';
  const answer = beats.join('');
  return { id: qid, gameId: id, prompt: 'いろの じゅんばんで たいこを たたこう！',
    visual: { kind: 'rhythm', preview: beats }, answer, choices: [answer, 'やりなおし'],
    explanation: 'リズムに のれたね！' };
}
