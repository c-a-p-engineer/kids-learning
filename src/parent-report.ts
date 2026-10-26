import { GAMES } from './engine';
import type { LearningSave } from './engine';
import { dayKey } from './progression';
export interface PeriodStat { days: number; answered: number; independent: number; supported: number; practiced: number; rested: number; mistakes: number; xp: number; clears: number }
export function parentPeriod(save: LearningSave, now: Date, count: number): PeriodStat {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - count + 1, 12);
  const from = dayKey(start), to = dayKey(now);
  const result: PeriodStat = { days: 0, answered: 0, independent: 0, supported: 0,
    practiced: 0, rested: 0, mistakes: 0, xp: 0, clears: 0 };
  for (const [key, day] of Object.entries(save.daily)) {
    if (key < from || key > to) continue;
    if (day.answered || day.clears) result.days++;
    for (const field of ['answered', 'independent', 'supported', 'practiced', 'rested',
      'mistakes', 'xp', 'clears'] as const) result[field] += day[field];
  }
  return result;
}
const quote = (x: string | number): string => '"' + String(x).replace(/"/g, '""') + '"';
/** UTF-8 BOM for Japanese Excel; retains distinct correct/practice and per-game clear counts. */
export function learningCsv(save: LearningSave, now: Date): string {
  const from = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 12));
  const to = dayKey(now);
  const days = Object.entries(save.daily).filter(([day]) => day >= from && day <= to)
    .sort(([a], [b]) => a.localeCompare(b));
  const header = ['日付', '取り組み', '独力正答', '補助後正答', '練習', '休憩', '誤答タップ', '獲得XP', 'クリア',
    ...GAMES.map(game => game.title)];
  return '\ufeff' + [header.map(quote).join(','), ...days.map(([date, d]) =>
    [date, d.answered, d.independent, d.supported, d.practiced, d.rested, d.mistakes,
      d.xp, d.clears, ...GAMES.map(g => d.games[g.id] ?? 0)].map(quote).join(','))].join('\r\n');
}
