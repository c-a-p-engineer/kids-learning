import { GAMES, MAX_LEVEL, CLEARS_PER_LEVEL, unlockedLevel } from './engine';
import type { GameId, LearningSave } from './engine';

/** Aggregates are local-device, per-character. No clock time, personal identifiers or analytics API. */
export interface DailyLog {
  answered: number;
  independent: number;
  supported: number;
  practiced: number;
  rested: number;
  mistakes: number;
  xp: number;
  clears: number;
  games: Record<string, number>;
}
export type LearningEvent = 'independent' | 'supported' | 'practice' | 'rest' | 'mistake' | 'clear';
const LIMIT = 1000000;
const counter = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? Math.min(value, LIMIT) : 0;
const isDay = (key: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const dt = new Date(key + 'T12:00:00');
  return Number.isFinite(dt.getTime()) && dayKey(dt) === key;
};
export const blankDay = (): DailyLog => ({
  answered: 0, independent: 0, supported: 0, practiced: 0, rested: 0,
  mistakes: 0, xp: 0, clears: 0, games: {}
});
/** Local date, not UTC: a study at 00:30 JST belongs to the new day. */
export function dayKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}
/** Preserve V2.5 saves. Treat malformed/unknown fields as untrusted, never execute user data. */
export function readDaily(raw: unknown): Record<string, DailyLog> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, DailyLog> = Object.create(null);
  for (const [date, value] of Object.entries(raw)) {
    if (!isDay(date) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const source = value as Record<string, unknown>;
    const day = blankDay();
    for (const key of ['answered', 'independent', 'supported', 'practiced', 'rested',
      'mistakes', 'xp', 'clears'] as const) day[key] = counter(source[key]);
    if (source.games && typeof source.games === 'object' && !Array.isArray(source.games)) {
      for (const game of GAMES) {
        const n = counter((source.games as Record<string, unknown>)[game.id]);
        if (n) day.games[game.id] = n;
      }
    }
    result[date] = day;
  }
  return result;
}
export function recordDaily(save: LearningSave, date: Date, gameId: GameId, event: LearningEvent, earned = 0): void {
  const key = dayKey(date);
  const day = save.daily[key] ?? blankDay();
  save.daily[key] = day;
  if (event === 'clear') {
    day.clears++;
    day.games[gameId] = (day.games[gameId] ?? 0) + 1;
  } else if (event === 'mistake') {
    day.mistakes++;
  } else {
    day.answered++;
    if (event === 'independent') day.independent++;
    if (event === 'supported') day.supported++;
    if (event === 'practice') day.practiced++;
    if (event === 'rest') day.rested++;
    day.xp += earned;
  }
}
export interface SkillNode {
  gameId: GameId;
  level: number;
  opened: boolean;
  requiredClears: number;
}
/** A skill tree is an unlock map, not a score of cognitive or therapeutic proficiency. */
export function skillNodes(gameId: GameId, completed: LearningSave['completed']): SkillNode[] {
  const current = unlockedLevel(completed[gameId] ?? 0);
  return Array.from({ length: MAX_LEVEL }, (_, i) => ({
    gameId, level: i + 1, opened: i + 1 <= current,
    requiredClears: i * CLEARS_PER_LEVEL
  }));
}
export function skillSummary(save: LearningSave): { unlocked: number; total: number; maxed: number } {
  const unlocked = GAMES.reduce((sum, game) => sum + unlockedLevel(save.completed[game.id] ?? 0), 0);
  const maxed = GAMES.filter(game => unlockedLevel(save.completed[game.id] ?? 0) === MAX_LEVEL).length;
  return { unlocked, total: GAMES.length * MAX_LEVEL, maxed };
}
export function recentDays(logs: LearningSave['daily'], end: Date, count = 14):
  Array<{ key: string; log: DailyLog }> {
  const result: Array<{ key: string; log: DailyLog }> = [];
  for (let i = Math.min(31, Math.max(1, count)) - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i, 12);
    const key = dayKey(d);
    result.push({ key, log: logs[key] ?? blankDay() });
  }
  return result;
}
export function recentSummary(logs: LearningSave['daily'], end: Date, count = 7) {
  const days = recentDays(logs, end, count);
  return {
    days: days.filter(d => d.log.answered || d.log.clears).length,
    questions: days.reduce((sum, d) => sum + d.log.answered, 0),
    independent: days.reduce((sum, d) => sum + d.log.independent, 0),
    clears: days.reduce((sum, d) => sum + d.log.clears, 0),
    xp: days.reduce((sum, d) => sum + d.log.xp, 0)
  };
}

/** Gentle, optional practice suggestion. No score diagnosis or forced level downgrade. */
export function reviewSuggestion(save: LearningSave, gameId: GameId, now: number): {
  level: number; hasStruggle: boolean; due: number;
} {
  const unlocked = unlockedLevel(save.completed[gameId] ?? 0);
  const items = Object.values(save.reviews).filter(r =>
    r.question.gameId === gameId && Number.isFinite(r.lastAnsweredAt) &&
    r.lastAnsweredAt <= now && r.lastAnsweredAt >= now - 14 * 86400000);
  const recent = items.sort((a, b) => b.lastAnsweredAt - a.lastAnsweredAt).slice(0, 5);
  const hasStruggle = unlocked > 1 && recent.length >= 3 &&
    recent.filter(record => !record.correct).length >= 3;
  const due = Object.values(save.reviews).filter(r =>
    r.question.gameId === gameId && r.dueAt <= now).length;
  return { level: hasStruggle ? unlocked - 1 : unlocked, hasStruggle, due };
}
