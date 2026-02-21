import type { Mission, StrokeGuide } from "./types";

export const STORAGE_KEYS = {
  missions: "h_m_v12",
  history: "h_h_v12",
} as const;

export const STROKE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"] as const;

export const CANVAS_SIZE = 320;

export const REPLAY_CANVAS_SIZE = 280;

export const GUIDE_DATA: Record<string, StrokeGuide[]> = {
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
  default: [{ n: [150, 80], s: [160, 90], e: [160, 240] }],
};

export const DEFAULT_MISSIONS: Mission[] = [
  {
    id: "mission-aiueo-h",
    title: "あいうえお",
    word: "あいうえお",
    count: 1,
    current: 0,
  },
  {
    id: "mission-aiueo-k",
    title: "アイウエオ",
    word: "アイウエオ",
    count: 1,
    current: 0,
  },
];
