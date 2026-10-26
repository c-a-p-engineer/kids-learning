import { nextReview } from './engine';
import type { LearningSave, Question } from './engine';
import type { Session } from './session';
import { recordDaily, dayKey } from './progression';
import type { LearningEvent } from './progression';

/** Clone only the affected storage buckets, never mutate a previously saved daily record. */
function workingCopy(save: LearningSave, day: Date): LearningSave {
  const today = dayKey(day);
  const prior = save.daily[today];
  return { ...save, reviews: { ...save.reviews }, completed: { ...save.completed },
    daily: { ...save.daily, ...(prior ? { [today]: { ...prior, games: { ...prior.games } } } : {}) } };
}
/** Prepare exactly one persistent correct answer; caller commits this result atomically. */
export function prepareAnswer(save: LearningSave, q: Question, kind: LearningEvent,
  independent: boolean, earned: number, when: Date): { data: LearningSave; recalled: boolean } {
  const data = workingCopy(save, when);
  const time = when.getTime();
  const recalled = kind !== 'practice' && kind !== 'rest' &&
    Boolean(save.reviews[q.id]?.dueAt && save.reviews[q.id].dueAt <= time);
  if (kind !== 'practice' && kind !== 'rest')
    data.reviews[q.id] = nextReview(save.reviews[q.id], q, independent, time);
  data.xp += earned;
  recordDaily(data, when, q.gameId, kind, earned);
  return { data, recalled };
}
/** A wrong tap updates only daily mistakes and never silently loses persistence errors. */
export function prepareMistake(save: LearningSave, q: Question, when: Date): LearningSave {
  const data = workingCopy(save, when);
  recordDaily(data, when, q.gameId, 'mistake');
  return data;
}
/** Persist only at the five-question boundary, preserving previous data on a failed write. */
export function prepareClear(save: LearningSave, session: Session, when: Date): LearningSave {
  const data = workingCopy(save, when);
  data.sessions++;
  recordDaily(data, when, session.gameId, 'clear');
  if (session.gameId !== 'move' || session.practiced > 0)
    data.completed[session.gameId] = (data.completed[session.gameId] ?? 0) + 1;
  return data;
}
