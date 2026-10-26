import type { GameId, Question } from './engine';

/** 学習操作そのものが回答。Choiceクイズとは別の入力形式で扱う。 */
export type ActivityKind = 'trace' | 'lines' | 'digits' | 'blocks' | 'train' | 'move';
export type ActivityId = Extract<GameId, 'trace' | 'lines' | 'digits' | 'blocks' | 'train' | 'move'>;
export const isActivity = (id: GameId): id is ActivityId =>
  id === 'trace' || id === 'lines' || id === 'digits' || id === 'blocks' || id === 'train' || id === 'move';

// Keep teaching content separate from stroke geometry and input validation.
import { TRACE_GUIDES, PREWRITING, KANA, NUMERALS } from './trace-guides';
export { TRACE_GUIDES } from './trace-guides';
export type { TraceGlyph } from './trace-guides';

const WORDS = [
  { word: 'ねこ', emoji: '🐱' },
  { word: 'いぬ', emoji: '🐶' },
  { word: 'くま', emoji: '🐻' },
  { word: 'うさぎ', emoji: '🐰' },
  { word: 'さかな', emoji: '🐟' },
  { word: 'りんご', emoji: '🍎' },
  { word: 'すいか', emoji: '🍉' },
  { word: 'かえる', emoji: '🐸' },
  { word: 'きつね', emoji: '🦊' },
  { word: 'さくら', emoji: '🌸' },
  { word: 'でんしゃ', emoji: '🚂' },
  { word: 'ひこうき', emoji: '✈️' }
] as const;
export const MOVE_CARDS = [
  { emoji: '🙌', name: 'おてて ばんざい', instruction: 'てを ゆっくり うえに のばそう', seated: 'すわった まま てを あげても OK' },
  { emoji: '👏', name: 'ぱちぱち てあわせ', instruction: 'てを 3かい ぱちぱち しよう', seated: 'すわって ぱちぱち でも OK' },
  { emoji: '🦋', name: 'ちょうちょ ぱたぱた', instruction: 'うでを ゆっくり ひらいて とじよう', seated: 'すわって うでを うごかそう' },
  { emoji: '👣', name: 'あしぶみ とことこ', instruction: 'そのばで ゆっくり あしぶみ しよう', seated: 'すわって あしを こうごに あげよう' },
  { emoji: '🐢', name: 'ゆっくり かたまわし', instruction: 'かたを ちいさく まわしてみよう', seated: 'うごかしにくければ みるだけでも OK' },
  { emoji: '⭐', name: 'ほしに とどけ', instruction: 'かたほうの てを そらに のばそう', seated: 'すわって のばしても OK' },
  { emoji: '🪞', name: 'まねっこ みぎひだり', instruction: 'みぎの て、ひだりの てを じゅんばんに あげよう', seated: 'すわった ままで OK' },
  { emoji: '👐', name: 'てを ぎゅっぱ', instruction: 'てを やさしく にぎって ひらこう', seated: 'すわった ままで OK' },
  { emoji: '🌻', name: 'おひさま のびのび', instruction: 'りょうてを むねの まえから ゆっくり ひらこう', seated: 'うでだけ うごかせば OK' },
  { emoji: '🐱', name: 'ねこ こっくり', instruction: 'あごを すこし ひいて、まえを みよう', seated: 'くびが いたければ しないで OK' },
  { emoji: '🥁', name: 'リズム ぱちぱち', instruction: 'ぱん・ぱん・おやすみ の じゅんで やってみよう', seated: 'てだけ うごかせば OK' },
  { emoji: '👐', name: 'みぎ ひだり ぱっ', instruction: 'みぎてを ひらいて、ひだりてを ひらいてみよう', seated: 'すわった ままでも OK' },
  { emoji: '🎵', name: 'ゆっくり はやく', instruction: 'ゆっくり 2かい、すこし はやく 2かい てを たたこう', seated: 'はやさは じぶんで きめていいよ' }
] as const;

/** Deterministic per-game prompt; no camera, motion inference or third-party data. */
export function makeActivityQuestion(gameId: ActivityId, i: number, level: number): Question {
  const id = gameId + (level > 1 ? ':L' + level : '') + ':' + i;
  if (gameId === 'trace' || gameId === 'lines' || gameId === 'digits') {
    const names: readonly string[] = gameId === 'lines' ? PREWRITING : gameId === 'digits' ? NUMERALS : KANA;
    const symbol = names[(i + (level - 1) * 2) % names.length];
    const guide = TRACE_GUIDES[symbol];
    return { id, gameId, prompt: gameId === 'lines' ?
      'ゆびで ' + guide.label + 'を なぞろう！' : gameId === 'digits' ?
      'すうじの ' + symbol + ' を なぞろう！' : '「' + symbol + '」を かこう！',
      visual: { kind: 'trace', symbol }, choices: [symbol, 'やりなおす'],
      answer: symbol, explanation: guide.label + 'を かけたね！' };
  }
  if (gameId === 'blocks') {
    const target = level === 1 ? [5,6,7,8,10][i % 5] :
      level === 2 ? [9,10,11,12,15][i % 5] :
      level === 3 ? [10,12,13,14,15][i % 5] :
      level === 4 ? [15,16,17,18,20][i % 5] : [16,17,18,19,20][i % 5];
    return { id, gameId, prompt: 'ブロックを ' + target + 'こ いれてみよう！',
      visual: { kind: 'blocks', a: target }, choices: [String(target), String(target + 1)],
      answer: String(target), explanation: target + 'こ あつまって こうじょうが うごいた！' };
  }
  if (gameId === 'train') {
    const candidates = WORDS.filter(w => level < 3 ? w.word.length <= 3 : true);
    const item = candidates[i % candidates.length];
    const letters = Array.from(item.word);
    // Deterministic reversed/rotated order; avoid always presenting completed word.
    const shuffled = letters.length === 2 ? [...letters].reverse() :
      [...letters.slice(1), letters[0]];
    return { id, gameId, prompt: item.emoji + ' の なまえを つくろう！',
      visual: { kind: 'train', symbol: item.emoji, preview: shuffled },
      choices: [item.word, 'ちがう ならび'], answer: item.word,
      explanation: '「' + item.word + '」が できた！ れっしゃ しゅっぱつ！' };
  }
  const card = MOVE_CARDS[(i + (level - 1) * 2) % MOVE_CARDS.length];
  return { id, gameId, prompt: card.name,
    visual: { kind: 'move', symbol: card.emoji, a: (i + (level - 1) * 2) % MOVE_CARDS.length },
    choices: ['やってみた', 'おやすみ'], answer: 'やってみた',
    explanation: 'からだを うごかしたり、みて まねしたり できたね！' };
}
