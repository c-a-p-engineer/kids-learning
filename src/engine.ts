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
  { id: 'clock', title: 'じかんの とびら', icon: '🕒', subject: 'せいかつ', description: 'とけいの じかんを あてよう', color: '#7892e8' },
  { id: 'bond', title: '10の ともだち', icon: '🤝', subject: 'さんすう', description: 'あわせて 10になる かずを みつけよう', color: '#f2a257' },
  { id: 'pattern', title: 'つぎは なあに？', icon: '🧩', subject: 'かんがえる', description: 'ならびかたの ひみつを みつけよう', color: '#7e89ec' },
  { id: 'category', title: 'なかま あつめ', icon: '🧺', subject: 'ことば', description: 'どんな なかまに はいるかな？', color: '#38bfa1' },
  { id: 'odd', title: 'ちがいを はっけん', icon: '🔍', subject: 'かんがえる', description: 'ひとつだけ ちがう ものを さがそう', color: '#e57eb3' },
  { id: 'colors', title: 'いろの まほう', icon: '🎨', subject: 'せいかつ', description: 'いろの なまえを おぼえよう', color: '#59a6e5' }
] as const;

export const MAX_LEVEL = 5;
export const CLEARS_PER_LEVEL = 2;
export function unlockedLevel(clears: number): number {
  const count = Number.isFinite(clears) ? Math.max(0, Math.floor(clears)) : 0;
  return Math.min(MAX_LEVEL, 1 + Math.floor(count / CLEARS_PER_LEVEL));
}
export function progressFor(clears: number): { level: number; current: number; target: number; maxed: boolean } {
  const level = unlockedLevel(clears);
  return { level, current: level === MAX_LEVEL ? CLEARS_PER_LEVEL : Math.max(0, Math.floor(clears)) % CLEARS_PER_LEVEL,
    target: CLEARS_PER_LEVEL, maxed: level === MAX_LEVEL };
}

export type GameId = (typeof GAMES)[number]['id'];
export type Visual = {
  kind: 'dots' | 'add' | 'subtract' | 'sequence' | 'compare' | 'picture' | 'shape' | 'clock' | 'memory' | 'bond' | 'pattern' | 'category' | 'odd' | 'color';
  a?: number; b?: number; step?: number; numbers?: number[];
  symbol?: string; hour?: number; minute?: number; preview?: string[]; answerIndex?: number;
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
  settings: { quiet: boolean; sound: boolean; bgm: boolean; bgmVolume: number; seVolume: number };
}
export const STORAGE_KEY = 'kids_learning_dopagaki_v2';
export function freshSave(): LearningSave {
  return { schema: 2, xp: 0, sessions: 0, completed: {}, reviews: {}, settings: { quiet: false, sound: true, bgm: true, bgmVolume: 75, seVolume: 65 } };
}
/** 保存データの不正な値を無害化する。V2旧データに音量がなければ初期値を使用。 */
export function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
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

export function makeQuestion(gameId: GameId, index: number, level = 1): Question {
  const i = Math.max(0, Math.floor(index));
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const id = gameId + (lv > 1 ? ':L' + lv : '') + ':' + i;
  if (gameId === 'count') {
    const a = lv === 1 ? (i % 10) + 1 :
      lv === 2 ? (i % 15) + 1 :
      lv === 3 ? (i % 15) + 6 :
      lv === 4 ? (i % 10) + 11 : (i * 7 % 20) + 1;
    return { id, gameId, prompt: 'まるは なんこ あるかな？', visual: { kind: 'dots', a }, choices: numberChoices(a, i, lv === 1 ? 10 : 20), answer: String(a), explanation: 'まるを ひとつずつ かぞえると ' + a + 'こ！' };
  }
  if (gameId === 'add') {
    const a = lv === 1 ? (i % 5) + 1 : lv === 2 ? (i % 7) + 2 : lv === 3 ? (i % 8) + 4 : (i % 10) + 5;
    const b = lv === 1 ? (Math.floor(i / 5) % 4) + 1 : lv === 2 ? (Math.floor(i / 7) % 4) + 1 :
      lv === 3 ? (Math.floor(i / 8) % 5) + 1 : (Math.floor(i / 10) % 6) + 1;
    const answer = a + b;
    return { id, gameId, prompt: 'ぜんぶで なんこ？', visual: { kind: 'add', a, b }, choices: numberChoices(answer, i, lv === 1 ? 10 : 20), answer: String(answer), explanation: a + 'こと ' + b + 'こを あわせると ' + answer + 'こ！' };
  }
  if (gameId === 'subtract') {
    const a = lv === 1 ? (i % 6) + 5 : lv === 2 ? (i % 7) + 7 :
      lv === 3 ? (i % 7) + 10 : (i % 8) + 13;
    const b = lv === 1 ? (Math.floor(i / 6) % 5) + 1 : lv === 2 ? (Math.floor(i / 7) % 6) + 1 :
      lv === 3 ? (Math.floor(i / 7) % 8) + 1 : (Math.floor(i / 8) % 10) + 1;
    const answer = a - b;
    return { id, gameId, prompt: 'のこりは なんこ？', visual: { kind: 'subtract', a, b }, choices: numberChoices(answer, i, lv === 1 ? 10 : 20), answer: String(answer), explanation: a + 'こから ' + b + 'こ とると ' + answer + 'こ！' };
  }
  if (gameId === 'sequence') {
    const a = lv === 1 ? (i % 8) + 1 : lv === 2 ? (i % 12) + 1 : (i % 16) + 2;
    const step = lv === 1 ? (Math.floor(i / 8) % 2) + 1 : lv === 2 ? (Math.floor(i / 12) % 2) + 1 :
      lv === 3 ? (Math.floor(i / 16) % 3) + 1 : (Math.floor(i / 16) % 3) + (lv === 4 ? 2 : 3);
    const answer = a + step * 2;
    return { id, gameId, prompt: '「？」に はいる かずは？', visual: { kind: 'sequence', numbers: [a, a + step, -1, a + 3 * step], step }, choices: numberChoices(answer, i, lv === 1 ? 20 : 40), answer: String(answer), explanation: step + 'ずつ ふえているよ。' + answer + 'が はいるね！' };
  }
  if (gameId === 'compare') {
    const max = lv <= 2 ? (lv === 1 ? 9 : 12) : lv === 3 ? 16 : 20;
    const a = (i % max) + 1;
    let b = lv === 5 ? (a === max ? max - 1 : a + 1) : ((i * 5 + 2 + Math.floor(i / max)) % max) + 1;
    if (a === b) b = a === max ? max - 1 : a + 1;
    const answer = a > b ? 'ひだり' : 'みぎ';
    return { id, gameId, prompt: 'おおきい かずは どっち？', visual: { kind: 'compare', a, b }, choices: ['ひだり', 'みぎ'], answer, explanation: String(Math.max(a, b)) + 'の ほうが おおきいね！' };
  }
  if (gameId === 'kana') {
    const item = ITEMS[i % ITEMS.length];
    const other = [...new Set(ITEMS.map(x => x.first).filter(x => x !== item.first))];
    const choices = rotated([item.first, ...rotated(other, i).slice(0, Math.min(5, lv + 1))], i);
    return { id, gameId, prompt: 'この えの なまえ。はじめの もじは？', visual: { kind: 'picture', symbol: item.emoji }, choices, answer: item.first, explanation: '「' + item.word + '」の はじめは 「' + item.first + '」！' };
  }
  if (gameId === 'words') {
    const item = ITEMS[i % ITEMS.length];
    const distractors = ITEMS.filter(x => x.word !== item.word).map(x => x.word);
    const choices = rotated([item.word, ...rotated(distractors, i).slice(0, Math.min(5, lv + 1))], i);
    return { id, gameId, prompt: 'この えと おなじ ことばは？', visual: { kind: 'picture', symbol: item.emoji }, choices, answer: item.word, explanation: item.emoji + 'は 「' + item.word + '」だね！' };
  }
  if (gameId === 'shapes') {
    const symbol = SHAPES[i % SHAPES.length];
    const distractors = SHAPES.filter(s => s !== symbol);
    const choices = rotated([symbol, ...rotated(distractors, i).slice(0, Math.min(5, lv + 1))], i);
    return { id, gameId, prompt: 'おなじ かたちは どれ？', visual: { kind: 'shape', symbol }, choices, answer: symbol, explanation: 'この かたちが ぴったり！' };
  }
  if (gameId === 'memory') {
    const at = i % MEMORY.length;
    const span = lv <= 2 ? 3 : lv === 3 ? 4 : 5;
    const preview = Array.from({ length: span }, (_, j) => MEMORY[(at + j) % MEMORY.length]);
    const answer = preview[(i + Math.floor(i / 12)) % span];
    const choices = rotated([answer, ...MEMORY.filter(x => !preview.includes(x)).slice(0, Math.min(5, lv + 1))], i);
    return { id, gameId, prompt: 'さっき あった えは どれ？', visual: { kind: 'memory', preview }, choices, answer, explanation: 'よく おぼえていたね！ ' + answer + 'が あったよ。' };
  }
  if (gameId === 'clock') {
    const hour = (i % 12) + 1;
    const minute = lv <= 2 ? (Math.floor(i / 12) % 2) * 30 :
      lv <= 4 ? (Math.floor(i / 12) % 4) * 15 : (Math.floor(i / 12) % 12) * 5;
    const suffix = (mins: number) => mins === 0 ? '' : mins === 30 ? 'はん' : String(mins) + 'ふん';
    const answer = String(hour) + 'じ' + suffix(minute);
    const next = hour === 12 ? 1 : hour + 1;
    const previous = hour === 1 ? 12 : hour - 1;
    const choices = rotated([answer, String(next) + 'じ' + suffix(minute),
      String(previous) + 'じ' + suffix(minute)], i);
    return { id, gameId, prompt: 'とけいは なんじ？', visual: { kind: 'clock', hour, minute }, choices, answer, explanation: 'みじかい はりを みよう。' + answer + 'だね！' };
  }

  if (gameId === 'bond') {
    const target = lv >= 4 ? 20 : lv >= 3 ? 15 : 10;
    const a = i % (target + 1), answer = target - a;
    return { id, gameId, prompt: 'あわせて ' + target + 'に なるのは？',
      visual: { kind: 'bond', a, b: target }, choices: numberChoices(answer, i, target),
      answer: String(answer), explanation: a + 'と ' + answer + 'で ' + target + 'に なるね！' };
  }
  if (gameId === 'pattern') {
    const symbols = ['⭐','🌙','🌼','🚂','🐱','🍎','🔴','🔵'];
    const a = symbols[i % symbols.length], b = symbols[(i + 3) % symbols.length];
    const c = symbols[(i + 5) % symbols.length];
    const series = lv >= 4 ? [a,b,c] : [a,b];
    const prefix = Array.from({ length: lv === 5 ? 7 : lv >= 3 ? 5 : (i % 2 === 0 ? 3 : 4) },
      (_, j) => series[j % series.length]);
    const answer = series[prefix.length % series.length];
    const choices = rotated([answer, ...symbols.filter(x => !series.includes(x)).slice(0, Math.min(5, lv + 1))], i);
    return { id, gameId, prompt: 'ならびかたを みて、つぎは？',
      visual: { kind: 'pattern', preview: prefix }, choices, answer,
      explanation: 'おなじ ならびが くりかえされているね！ ' + answer + 'が つぎ！' };
  }
  if (gameId === 'category') {
    const sets = [
      { name:'どうぶつ', icons:['🐱','🐶','🐰','🐘'] },
      { name:'のりもの', icons:['🚂','🚗','🚲','🚌'] },
      { name:'たべもの', icons:['🍎','🍙','🍉','🍞'] },
      { name:'しぜん', icons:['🌳','🌻','🌈','☁️'] }
    ];
    const group = sets[i % sets.length], emoji = group.icons[Math.floor(i / sets.length) % group.icons.length];
    const choices = rotated([group.name, ...sets.filter(x => x.name !== group.name).slice(0, lv >= 3 ? 3 : 2).map(x => x.name)], i);
    return { id, gameId, prompt: 'これは なんの なかま？',
      visual: { kind: 'category', symbol: emoji }, choices, answer: group.name,
      explanation: emoji + 'は 「' + group.name + '」の なかまだね！' };
  }
  if (gameId === 'odd') {
    const icons = ['🐱','🍎','🚂','🐰','🌻','🐟','🎈','🚌'];
    const a = icons[i % icons.length], b = icons[(i + 3) % icons.length];
    const count = lv === 5 ? 6 : lv >= 4 ? 5 : 4;
    const answerIndex = (i * 3 + Math.floor(i / 4)) % count;
    const preview = Array.from({ length: count }, (_, pos) => pos === answerIndex ? b : a);
    const answer = String(answerIndex + 1);
    return { id, gameId, prompt: 'ひとつだけ ちがうのは なんばん？',
      visual: { kind: 'odd', preview, answerIndex }, choices: rotated(Array.from({ length: count }, (_, j) => String(j + 1)), i),
      answer, explanation: answer + 'ばん だけ ちがう えだね！' };
  }
  if (gameId === 'colors') {
    const swatches = [
      { name:'あか', color:'#e94a52' }, { name:'あお', color:'#377bdd' },
      { name:'きいろ', color:'#f5cf42' }, { name:'みどり', color:'#43ae6b' },
      { name:'むらさき', color:'#9c65ce' }, { name:'オレンジ', color:'#f28a37' }
    ];
    const chosen = swatches[i % swatches.length];
    const choices = rotated([chosen.name, ...swatches.filter(x => x.name !== chosen.name).slice(0, Math.min(5, lv + 1)).map(x => x.name)], i);
    return { id, gameId, prompt: 'この いろの なまえは？',
      visual: { kind: 'color', symbol: chosen.color }, choices, answer: chosen.name,
      explanation: 'この いろは 「' + chosen.name + '」！' };
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
export function chooseRound(gameId: GameId, save: LearningSave, now: number, size = 5, level = 1): Question[] {
  const due = Object.values(save.reviews).filter(r => r.question.gameId === gameId && r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt).slice(0, 2).map(r => r.question);
  const seen = new Set(due.map(q => q.id));
  const result = [...due];
  const offset = save.completed[gameId] || 0;
  for (let attempt = 0; result.length < size && attempt < size + 30; attempt++) {
    const maxQuestions = level === 1 ? (gameId === 'clock' ? 24 : 48) : 80;
    const candidate = makeQuestion(gameId, (offset * size + attempt) % maxQuestions, level);
    if (!seen.has(candidate.id)) { result.push(candidate); seen.add(candidate.id); }
  }
  return result;
}
export function countDue(gameId: GameId, save: LearningSave, now: number): number {
  return Object.values(save.reviews).filter(r => r.question.gameId === gameId && r.dueAt <= now).length;
}
