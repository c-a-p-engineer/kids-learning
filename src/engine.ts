export const GAMES = [
  { id: 'count', title: 'かずシールド', icon: '🛡️', subject: 'さんすう', description: 'ドットを かぞえて シールドを こわそう', color: '#19b69e' },
  { id: 'add', title: 'たしざんロケット', icon: '🚀', subject: 'さんすう', description: 'ふたつの かずを あわせて とばそう', color: '#f49b3f' },
  { id: 'subtract', title: 'ひきざんスライム', icon: '🫧', subject: 'さんすう', description: 'へった かずを かんがえよう', color: '#9b7bf6' },
  { id: 'sequence', title: 'かずのレール', icon: '🚂', subject: 'さんすう', description: 'ぬけた かずを いれて でんしゃを はしらせよう', color: '#4389e7' },
  { id: 'compare', title: 'おおきいのは？', icon: '⚖️', subject: 'さんすう', description: 'おおきい かずを みつけよう', color: '#e77f9f' },
  { id: 'kana', title: 'はじめの もじ', icon: '🔤', subject: 'こくご', description: 'えの なまえの はじめの もじは？', color: '#e6a13d' },
  { id: 'words', title: 'ことばトレジャー', icon: '🗝️', subject: 'こくご', description: 'えと おなじ ことばを みつけよう', color: '#77b963' },
  { id: 'shapes', title: 'かたちパズル', icon: '🔷', subject: 'ずけい', description: 'おなじ かたちを さがそう', color: '#4ba8cd' },
  { id: 'memory', title: 'おぼえてカード', icon: '🧠', subject: 'きおく', description: 'えを みて おぼえて こたえよう', color: '#dc83c8' },
  { id: 'clock', title: 'じかんの とびら', icon: '🕒', subject: 'せいかつ', description: 'とけいの じかんを あてよう', color: '#7892e8' }
] as const;

export type GameId = (typeof GAMES)[number]['id'];
export type Visual = {
  kind: 'dots' | 'add' | 'subtract' | 'sequence' | 'compare' | 'picture' | 'shape' | 'clock' | 'memory';
  a?: number; b?: number; step?: number; numbers?: number[];
  symbol?: string; hour?: number; minute?: number; preview?: string[];
};
export interface Question {
  id: string;
  gameId: GameId;
  prompt: string;
  visual: Visual;
  choices: string[];
  answer: string;
  explanation: string;
}
export interface ReviewRecord {
  question: Question;
  stage: number;
  dueAt: number;
  lastAnsweredAt: number;
  correct: boolean;
}
export interface LearningSave {
  schema: 2;
  xp: number;
  sessions: number;
  completed: Record<string, number>;
  reviews: Record<string, ReviewRecord>;
  settings: { quiet: boolean; sound: boolean };
}
export const STORAGE_KEY = 'kids_learning_dopagaki_v2';
export function freshSave(): LearningSave {
  return { schema: 2, xp: 0, sessions: 0, completed: {}, reviews: {}, settings: { quiet: false, sound: false } };
}
function options(answer: number, min = 0, max = 20): string[] {
  const pool = [answer, answer - 1, answer + 1, answer + 2, answer - 2, answer + 3, answer - 3];
  const unique = [...new Set(pool.filter(n => n >= min && n <= max))];
  return unique.slice(0, 3).map(String);
}
function rotated<T>(xs: T[], index: number): T[] {
  if (!xs.length) return [];
  const at = (index * 7 + 3) % xs.length;
  return [...xs.slice(at), ...xs.slice(0, at)];
}
function numberChoices(answer: number, index: number, max = 20): string[] {
  const a = options(answer, 0, max);
  if (a.length < 3) throw new Error('Too few choices');
  return rotated(a, index);
}
const ITEMS = [
  { emoji: '🍎', word: 'りんご', first: 'り' },
  { emoji: '🐱', word: 'ねこ', first: 'ね' },
  { emoji: '🐶', word: 'いぬ', first: 'い' },
  { emoji: '🐟', word: 'さかな', first: 'さ' },
  { emoji: '🌸', word: 'さくら', first: 'さ' },
  { emoji: '🚂', word: 'でんしゃ', first: 'で' },
  { emoji: '🍉', word: 'すいか', first: 'す' },
  { emoji: '🐰', word: 'うさぎ', first: 'う' },
  { emoji: '☂️', word: 'かさ', first: 'か' },
  { emoji: '🐸', word: 'かえる', first: 'か' },
  { emoji: '🦊', word: 'きつね', first: 'き' },
  { emoji: '🐘', word: 'ぞう', first: 'ぞ' }
] as const;
const SHAPES = ['●', '▲', '■', '★', '◆', '♥', '⬟', '⬢'];
const MEMORY = ['🐱', '🚀', '🍎', '🐳', '🚂', '🌻', '🦊', '🍉', '🐸', '⚽', '🌈', '🐶'];

export function makeQuestion(gameId: GameId, index: number): Question {
  const i = Math.max(0, Math.floor(index));
  const id = gameId + ':' + i;
  if (gameId === 'count') {
    const a = (i % 10) + 1;
    return { id, gameId, prompt: 'まるは なんこ あるかな？', visual: { kind: 'dots', a }, choices: numberChoices(a, i, 10), answer: String(a), explanation: 'まるを ひとつずつ かぞえると ' + a + 'こ！' };
  }
  if (gameId === 'add') {
    const a = (i % 5) + 1, b = (Math.floor(i / 5) % 4) + 1, answer = a + b;
    return { id, gameId, prompt: 'ぜんぶで なんこ？', visual: { kind: 'add', a, b }, choices: numberChoices(answer, i, 10), answer: String(answer), explanation: a + 'こと ' + b + 'こを あわせると ' + answer + 'こ！' };
  }
  if (gameId === 'subtract') {
    const a = (i % 6) + 5, b = (Math.floor(i / 6) % 5) + 1, answer = a - b;
    return { id, gameId, prompt: 'のこりは なんこ？', visual: { kind: 'subtract', a, b }, choices: numberChoices(answer, i, 10), answer: String(answer), explanation: a + 'こから ' + b + 'こ とると ' + answer + 'こ！' };
  }
  if (gameId === 'sequence') {
    const a = (i % 8) + 1, step = (Math.floor(i / 8) % 2) + 1, answer = a + step * 2;
    return { id, gameId, prompt: '「？」に はいる かずは？', visual: { kind: 'sequence', numbers: [a, a + step, -1, a + 3 * step], step }, choices: numberChoices(answer, i, 20), answer: String(answer), explanation: step + 'ずつ ふえているよ。' + answer + 'が はいるね！' };
  }
  if (gameId === 'compare') {
    const a = (i % 9) + 1;
    let b = ((i * 5 + 2) % 9) + 1;
    if (a === b) b = a === 9 ? 8 : a + 1;
    const answer = a > b ? 'ひだり' : 'みぎ';
    return { id, gameId, prompt: 'おおきい かずは どっち？', visual: { kind: 'compare', a, b }, choices: ['ひだり', 'みぎ'], answer, explanation: String(Math.max(a, b)) + 'の ほうが おおきいね！' };
  }
  if (gameId === 'kana') {
    const item = ITEMS[i % ITEMS.length];
    const other = [...new Set(ITEMS.map(x => x.first).filter(x => x !== item.first))];
    const choices = rotated([item.first, ...rotated(other, i).slice(0, 2)], i);
    return { id, gameId, prompt: 'この えの なまえ。はじめの もじは？', visual: { kind: 'picture', symbol: item.emoji }, choices, answer: item.first, explanation: '「' + item.word + '」の はじめは 「' + item.first + '」！' };
  }
  if (gameId === 'words') {
    const item = ITEMS[i % ITEMS.length];
    const distractors = ITEMS.filter(x => x.word !== item.word).map(x => x.word);
    const choices = rotated([item.word, ...rotated(distractors, i).slice(0, 2)], i);
    return { id, gameId, prompt: 'この えと おなじ ことばは？', visual: { kind: 'picture', symbol: item.emoji }, choices, answer: item.word, explanation: item.emoji + 'は 「' + item.word + '」だね！' };
  }
  if (gameId === 'shapes') {
    const symbol = SHAPES[i % SHAPES.length];
    const distractors = SHAPES.filter(s => s !== symbol);
    const choices = rotated([symbol, ...rotated(distractors, i).slice(0, 2)], i);
    return { id, gameId, prompt: 'おなじ かたちは どれ？', visual: { kind: 'shape', symbol }, choices, answer: symbol, explanation: 'この かたちが ぴったり！' };
  }
  if (gameId === 'memory') {
    const at = i % MEMORY.length;
    const preview = [MEMORY[at], MEMORY[(at + 1) % MEMORY.length], MEMORY[(at + 2) % MEMORY.length]];
    const answer = preview[1];
    const choices = rotated([answer, MEMORY[(at + 4) % MEMORY.length], MEMORY[(at + 6) % MEMORY.length]], i);
    return { id, gameId, prompt: 'さっき あった えは どれ？', visual: { kind: 'memory', preview }, choices, answer, explanation: 'よく おぼえていたね！ ' + answer + 'が あったよ。' };
  }
  if (gameId === 'clock') {
    const hour = (i % 12) + 1, minute = (Math.floor(i / 12) % 2) * 30;
    const answer = String(hour) + 'じ' + (minute === 30 ? 'はん' : '');
    const next = hour === 12 ? 1 : hour + 1;
    const previous = hour === 1 ? 12 : hour - 1;
    const choices = rotated([answer, String(next) + 'じ' + (minute === 30 ? 'はん' : ''), String(previous) + 'じ' + (minute === 30 ? 'はん' : '')], i);
    return { id, gameId, prompt: 'とけいは なんじ？', visual: { kind: 'clock', hour, minute }, choices, answer, explanation: 'みじかい はりを みよう。' + answer + 'だね！' };
  }
  throw new Error('Unknown game ' + gameId);
}
export function isGameId(value: string): value is GameId {
  return GAMES.some(game => game.id === value);
}
export function evaluate(question: Question, choice: string): boolean {
  return question.choices.includes(choice) && choice === question.answer;
}
export function nextReview(record: ReviewRecord | undefined, question: Question, independent: boolean, now: number): ReviewRecord {
  const intervals = [1, 3, 7, 14];
  const stage = independent ? Math.min((record?.stage ?? -1) + 1, 3) : 0;
  return { question, stage, dueAt: now + intervals[stage] * 86400000, lastAnsweredAt: now, correct: independent };
}
export function chooseRound(gameId: GameId, save: LearningSave, now: number, size = 5): Question[] {
  const due = Object.values(save.reviews).filter(r => r.question.gameId === gameId && r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt).slice(0, 2).map(r => r.question);
  const seen = new Set(due.map(q => q.id));
  const result = [...due];
  const offset = save.completed[gameId] || 0;
  for (let attempt = 0; result.length < size && attempt < size + 30; attempt++) {
    const candidate = makeQuestion(gameId, (offset * size + attempt) % (gameId === 'clock' ? 24 : 48));
    if (!seen.has(candidate.id)) { result.push(candidate); seen.add(candidate.id); }
  }
  return result;
}
export function countDue(gameId: GameId, save: LearningSave, now: number): number {
  return Object.values(save.reviews).filter(r => r.question.gameId === gameId && r.dueAt <= now).length;
}
