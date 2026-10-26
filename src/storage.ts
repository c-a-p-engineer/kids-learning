import { GAMES, STORAGE_KEY, freshSave, clampVolume, clampTextSize, isGameId, makeQuestion } from './engine';
import type { LearningSave } from './engine';
import { readDaily } from './progression';

const LIMIT_BYTES = 3 * 1024 * 1024;
export const slotKey = (slot: number): string => STORAGE_KEY + '_player_' + slot;

/** Normalize a V2 object without referring to the browser. Old V1 keys are never touched. */
export function normalizeSave(parsed: unknown): LearningSave {
  try {
    if (!parsed || typeof parsed !== 'object') return freshSave();
    const obj = parsed as Partial<LearningSave>;
    if (obj.schema !== 2) return freshSave();
    const data = freshSave();
    data.xp = Number.isFinite(obj.xp) ? Math.max(0, Number(obj.xp)) : 0;
    data.sessions = Number.isFinite(obj.sessions) ? Math.max(0, Number(obj.sessions)) : 0;
    if (obj.completed && typeof obj.completed === 'object') {
      for (const game of GAMES) {
        const n = (obj.completed as Record<string, unknown>)[game.id];
        if (typeof n === 'number' && Number.isInteger(n) && n >= 0) data.completed[game.id] = Math.min(n, 100000);
      }
    }
    if (obj.settings && typeof obj.settings === 'object') {
      data.settings.quiet = obj.settings.quiet === true;
      data.settings.sound = typeof obj.settings.sound === 'boolean' ? obj.settings.sound : true;
      data.settings.bgm = obj.settings.bgm !== false;
      data.settings.bgmVolume = clampVolume(obj.settings.bgmVolume, 75);
      data.settings.seVolume = clampVolume(obj.settings.seVolume, 65);
      data.settings.textSize = clampTextSize(obj.settings.textSize);
    }
    data.daily = readDaily(obj.daily);
    if (obj.reviews && typeof obj.reviews === 'object') {
      for (const [key, value] of Object.entries(obj.reviews)) {
        if (!value || typeof value !== 'object') continue;
        const review = value as Partial<LearningSave['reviews'][string]>;
        const question = review.question;
        if (!question || !isGameId(String(question.gameId)) || typeof question.id !== 'string' ||
          !Array.isArray(question.choices) || !question.choices.every(x => typeof x === 'string') ||
          typeof question.answer !== 'string' || !question.choices.includes(question.answer) ||
          typeof question.prompt !== 'string' || typeof question.explanation !== 'string' ||
          !question.visual || typeof question.visual !== 'object' ||
          !Number.isFinite(review.dueAt) || !Number.isFinite(review.lastAnsweredAt)) continue;
        const suffix = question.id.slice(question.gameId.length + 1);
        const parts = suffix.match(/^(?:L([2-5]):)?(\d{1,3})$/);
        if (!question.id.startsWith(question.gameId + ':') || !parts) continue;
        const level = parts[1] ? Number(parts[1]) : 1;
        const index = Number(parts[2]);
        if (!Number.isInteger(index) || index < 0 || index > 200) continue;
        if (key !== question.id) continue;
        // Rebuild canonical questions for the matching difficulty level, not from persisted DOM data.
        const canonical = makeQuestion(question.gameId, index, level);
        data.reviews[key] = {
          question: canonical, stage: Math.max(0, Math.min(3, Math.floor(Number(review.stage) || 0))),
          dueAt: Number(review.dueAt), lastAnsweredAt: Number(review.lastAnsweredAt), correct: review.correct === true
        };
      }
    }
    return data;
  } catch {
    return freshSave();
  }
}

export function loadSlot(storage: Pick<Storage, 'getItem'>, slot: number): LearningSave {
  const raw = storage.getItem(slotKey(slot));
  return raw ? normalizeSave(JSON.parse(raw)) : freshSave();
}
export function persistSlot(storage: Pick<Storage, 'setItem'>, slot: number, save: LearningSave): void {
  storage.setItem(slotKey(slot), JSON.stringify(save));
}
export interface Backup {
  exportedAt: string;
  slot: number;
  data: LearningSave;
}
export function backupText(slot: number, save: LearningSave, now = new Date()): string {
  return JSON.stringify({ exportedAt: now.toISOString(), slot, data: save }, null, 2);
}
/** Reject a wrong-character backup or malformed envelope BEFORE any localStorage write. */
export function parseBackup(text: string, activeSlot: number): Backup {
  if (text.length > LIMIT_BYTES) throw new Error('ファイルが おおきすぎます（3MBまで）。');
  let json: unknown;
  try { json = JSON.parse(text); }
  catch { throw new Error('JSONファイルとして よみとれません。'); }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('バックアップの 形式が ちがいます。');
  const env = json as Record<string, unknown>;
  if (env.slot !== activeSlot) throw new Error('ほかの キャラの きろくです。キャラを きりかえてください。');
  if (!env.data || typeof env.data !== 'object' || Array.isArray(env.data) ||
      (env.data as Record<string, unknown>).schema !== 2)
    throw new Error('V2の きろくが みつかりません。');
  // A schema-only object must not silently overwrite a genuine child's records with defaults.
  const raw = env.data as Record<string, unknown>;
  if (typeof raw.xp !== 'number' || !Number.isFinite(raw.xp) || raw.xp < 0 ||
      typeof raw.sessions !== 'number' || !Number.isFinite(raw.sessions) || raw.sessions < 0 ||
      !raw.completed || typeof raw.completed !== 'object' || Array.isArray(raw.completed) ||
      !raw.reviews || typeof raw.reviews !== 'object' || Array.isArray(raw.reviews) ||
      !raw.settings || typeof raw.settings !== 'object' || Array.isArray(raw.settings)) {
    throw new Error('ふくげんに ひつような きろくが たりません。');
  }
  if (typeof env.exportedAt !== 'string' || !Number.isFinite(Date.parse(env.exportedAt)))
    throw new Error('バックアップの じこくが ちがいます。');
  return { exportedAt: env.exportedAt, slot: activeSlot, data: normalizeSave(env.data) };
}
export function backupDelta(current: LearningSave, incoming: LearningSave): {
  xp: [number, number]; sessions: [number, number]; clears: [number, number]; days: [number, number];
} {
  const clears = (v: LearningSave) => Object.values(v.completed).reduce((n, c) => n + c, 0);
  return { xp: [current.xp, incoming.xp], sessions: [current.sessions, incoming.sessions],
    clears: [clears(current), clears(incoming)],
    days: [Object.keys(current.daily).length, Object.keys(incoming.daily).length] };
}
