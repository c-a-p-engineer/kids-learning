import type { Mission, StrokeGuide } from "./types";

export const STORAGE_KEYS = {
  missions: "h_m_v12",
  history: "h_h_v12",
} as const;

export const STROKE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"] as const;

export const CANVAS_SIZE = 320;

export const REPLAY_CANVAS_SIZE = 280;

const MANUAL_GUIDE_DATA: Record<string, StrokeGuide[]> = {
  あ: [
    { n: [80, 140], s: [90, 140], e: [230, 140] },
    { n: [160, 80], s: [160, 85], e: [160, 260] },
    { n: [210, 180], s: [220, 170], e: [130, 240] },
  ],
  い: [
    { n: [70, 100], s: [90, 100], e: [90, 250] },
    { n: [200, 100], s: [220, 100], e: [220, 200] },
  ],
  う: [
    { n: [120, 60], s: [140, 70], e: [180, 90] },
    { n: [90, 150], s: [110, 150], e: [200, 250] },
  ],
  え: [
    { n: [130, 60], s: [140, 70], e: [180, 90] },
    { n: [100, 160], s: [110, 160], e: [220, 260] },
  ],
  お: [
    { n: [80, 140], s: [90, 140], e: [200, 140] },
    { n: [160, 80], s: [160, 85], e: [160, 240] },
    { n: [240, 100], s: [245, 105], e: [255, 115] },
  ],
};

const SMALL_KANA_TO_LARGE: Record<string, string> = {
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お",
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
  ゎ: "わ",
  っ: "つ",
  ゕ: "か",
  ゖ: "け",
  ァ: "ア",
  ィ: "イ",
  ゥ: "ウ",
  ェ: "エ",
  ォ: "オ",
  ャ: "ヤ",
  ュ: "ユ",
  ョ: "ヨ",
  ヮ: "ワ",
  ッ: "ツ",
  ヵ: "カ",
  ヶ: "ケ",
};

const BASE_STROKE_COUNT: Record<string, number> = {
  あ: 3,
  い: 2,
  う: 2,
  え: 2,
  お: 3,
  か: 3,
  き: 4,
  く: 1,
  け: 3,
  こ: 2,
  さ: 3,
  し: 1,
  す: 2,
  せ: 3,
  そ: 2,
  た: 4,
  ち: 2,
  つ: 1,
  て: 1,
  と: 2,
  な: 4,
  に: 3,
  ぬ: 2,
  ね: 2,
  の: 1,
  は: 3,
  ひ: 1,
  ふ: 4,
  へ: 1,
  ほ: 4,
  ま: 3,
  み: 2,
  む: 3,
  め: 2,
  も: 3,
  や: 3,
  ゆ: 2,
  よ: 2,
  ら: 2,
  り: 2,
  る: 1,
  れ: 2,
  ろ: 1,
  わ: 2,
  を: 3,
  ん: 1,
  ア: 2,
  イ: 2,
  ウ: 3,
  エ: 3,
  オ: 3,
  カ: 2,
  キ: 3,
  ク: 1,
  ケ: 3,
  コ: 2,
  サ: 3,
  シ: 3,
  ス: 2,
  セ: 2,
  ソ: 2,
  タ: 3,
  チ: 3,
  ツ: 3,
  テ: 1,
  ト: 2,
  ナ: 2,
  ニ: 2,
  ヌ: 2,
  ネ: 4,
  ノ: 1,
  ハ: 2,
  ヒ: 2,
  フ: 1,
  ヘ: 1,
  ホ: 4,
  マ: 2,
  ミ: 3,
  ム: 2,
  メ: 2,
  モ: 3,
  ヤ: 2,
  ユ: 2,
  ヨ: 3,
  ラ: 2,
  リ: 2,
  ル: 2,
  レ: 1,
  ロ: 3,
  ワ: 2,
  ヲ: 3,
  ン: 2,
  ー: 1,
};

const GENERIC_GUIDE_STEPS: StrokeGuide[] = [
  { n: [70, 92], s: [96, 102], e: [230, 104] },
  { n: [144, 72], s: [160, 88], e: [160, 250] },
  { n: [228, 136], s: [214, 132], e: [118, 240] },
  { n: [82, 148], s: [96, 160], e: [236, 240] },
  { n: [76, 232], s: [90, 228], e: [234, 228] },
  { n: [240, 86], s: [232, 100], e: [246, 232] },
  { n: [82, 86], s: [90, 98], e: [126, 250] },
  { n: [214, 78], s: [224, 90], e: [248, 148] },
];

const DAKUTEN_GUIDES: StrokeGuide[] = [
  { n: [248, 48], s: [238, 56], e: [252, 78] },
  { n: [268, 48], s: [258, 56], e: [272, 78] },
];

const HANDAKUTEN_GUIDE: StrokeGuide = { n: [258, 54], s: [254, 58], e: [266, 66] };

function normalizeBaseChar(char: string): string {
  if (SMALL_KANA_TO_LARGE[char]) {
    return SMALL_KANA_TO_LARGE[char];
  }

  const normalized = char.normalize("NFD");
  const withoutMarks = normalized.replace(/[\u3099\u309A]/g, "");
  return withoutMarks.charAt(0) || char;
}

function countMarks(char: string): { dakuten: boolean; handakuten: boolean } {
  const normalized = char.normalize("NFD");
  return {
    dakuten: normalized.includes("\u3099"),
    handakuten: normalized.includes("\u309A"),
  };
}

function buildGenericGuide(strokeCount: number): StrokeGuide[] {
  const count = Math.max(1, Math.min(strokeCount, GENERIC_GUIDE_STEPS.length));
  return GENERIC_GUIDE_STEPS.slice(0, count).map((step) => ({
    n: [step.n[0], step.n[1]],
    s: [step.s[0], step.s[1]],
    e: [step.e[0], step.e[1]],
  }));
}

export function getGuideStrokeCount(char: string): number {
  if (!char) return 1;
  if (MANUAL_GUIDE_DATA[char]) return MANUAL_GUIDE_DATA[char].length;

  const marks = countMarks(char);
  const baseChar = normalizeBaseChar(char);
  const baseCount = BASE_STROKE_COUNT[baseChar] ?? 2;

  let total = baseCount;
  if (marks.dakuten) total += 2;
  if (marks.handakuten) total += 1;

  return Math.max(1, Math.min(total, GENERIC_GUIDE_STEPS.length));
}

export function getGuidesForChar(char: string): StrokeGuide[] {
  if (!char) return buildGenericGuide(1);
  if (MANUAL_GUIDE_DATA[char]) return MANUAL_GUIDE_DATA[char];

  const marks = countMarks(char);
  const baseChar = normalizeBaseChar(char);
  const baseCount = BASE_STROKE_COUNT[baseChar] ?? 2;

  const baseGuides = buildGenericGuide(baseCount);
  const extraGuides: StrokeGuide[] = [];

  if (marks.dakuten) {
    extraGuides.push(...DAKUTEN_GUIDES);
  }
  if (marks.handakuten) {
    extraGuides.push(HANDAKUTEN_GUIDE);
  }

  return [...baseGuides, ...extraGuides].slice(0, GENERIC_GUIDE_STEPS.length);
}

export const DEFAULT_MISSIONS: Mission[] = [
  {
    id: "mission-aiueo-h",
    title: "あいうえお",
    word: "あいうえお",
    count: 1,
    current: 0,
    lastPracticedAt: null,
  },
  {
    id: "mission-aiueo-k",
    title: "アイウエオ",
    word: "アイウエオ",
    count: 1,
    current: 0,
    lastPracticedAt: null,
  },
];
