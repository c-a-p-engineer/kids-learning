import type { GameId, Question } from './engine';

/** 学習操作そのものが回答。Choiceクイズとは別の入力形式で扱う。 */
export type ActivityKind = 'trace' | 'blocks' | 'train' | 'move';
export type ActivityId = Extract<GameId, 'trace' | 'blocks' | 'train' | 'move'>;
export const isActivity = (id: GameId): id is ActivityId =>
  id === 'trace' || id === 'blocks' || id === 'train' || id === 'move';

/** 240×240で揃えた大まかな導線。完成文字の厳密な筆順/字形評価はしない。 */
export const TRACE_GUIDES = {
  'く': { path: 'M180 35 L65 119 L181 206',
    points: [[180,35],[146,60],[114,86],[80,110],[83,135],[120,163],[152,184],[181,206]] },
  'し': { path: 'M88 35 L87 163 Q90 208 140 199 Q170 193 179 162',
    points: [[88,35],[87,72],[87,112],[87,150],[100,188],[134,200],[163,188],[179,162]] },
  'つ': { path: 'M40 104 Q90 72 145 83 Q209 94 183 149 Q155 188 105 179',
    points: [[40,104],[78,87],[115,82],[150,86],[185,106],[185,145],[150,176],[105,179]] },
  'へ': { path: 'M37 153 L101 67 L206 164',
    points: [[37,153],[55,129],[79,96],[101,67],[126,90],[154,116],[180,140],[206,164]] },
  'こ': { path: 'M55 75 Q121 58 184 74 M56 159 Q102 185 182 163',
    points: [[55,75],[91,66],[135,65],[184,74],[56,159],[91,176],[136,174],[182,163]] },
  'い': { path: 'M63 58 Q63 146 110 174 M162 65 Q182 88 187 121',
    points: [[63,58],[64,91],[67,125],[86,156],[110,174],[162,65],[176,86],[187,121]] },
  'の': { path: 'M109 56 Q48 84 61 143 Q80 203 140 180 Q205 157 183 99 Q160 39 109 56 Q96 62 102 101',
    points: [[109,56],[75,87],[61,125],[77,169],[118,187],[166,167],[186,123],[165,77],[120,52],[102,101]] },
  'て': { path: 'M39 79 Q103 84 195 65 Q119 110 126 155 Q137 185 185 183',
    points: [[39,79],[81,82],[123,80],[164,72],[195,65],[145,100],[123,134],[146,173],[185,183]] }
} as const;
export type TraceGlyph = keyof typeof TRACE_GUIDES;

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
  { emoji: '🐱', name: 'ねこ こっくり', instruction: 'あごを すこし ひいて、まえを みよう', seated: 'くびが いたければ しないで OK' }
] as const;

/** Deterministic per-game prompt; no camera, motion inference or third-party data. */
export function makeActivityQuestion(gameId: ActivityId, i: number, level: number): Question {
  const id = gameId + (level > 1 ? ':L' + level : '') + ':' + i;
  if (gameId === 'trace') {
    const glyph = (Object.keys(TRACE_GUIDES) as TraceGlyph[])[(i + (level - 1) * 2) % Object.keys(TRACE_GUIDES).length];
    return { id, gameId, prompt: 'ゆびで「' + glyph + '」を なぞろう！',
      visual: { kind: 'trace', symbol: glyph },
      choices: [glyph, 'もういちど'], answer: glyph, explanation: '「' + glyph + '」を ゆっくり なぞれたね！' };
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
