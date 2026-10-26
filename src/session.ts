import type { GameId, Question } from './engine';

/** Pure session transitions: no DOM, audio, timers, storage or date. */
export type Phase = 'preview' | 'answer' | 'solved';
export type AnswerMode = 'practice' | 'skip';
export interface Session {
  gameId: GameId;
  level: number;
  deck: Question[];
  index: number;
  right: number;
  helped: number;
  practiced: number;
  skipped: number;
  wrong: number;
  phase: Phase;
  attempts: number;
  hints: number;
  feedback: string;
  locked: boolean;
  committed: Set<string>;
}
export function createSession(gameId: GameId, level: number, deck: Question[]): Session {
  if (!deck.length) throw new Error('A learning session needs at least one question.');
  return { gameId, level, deck, index: 0, right: 0, helped: 0, practiced: 0,
    skipped: 0, wrong: 0, phase: deck[0].visual.kind === 'memory' ? 'preview' : 'answer',
    attempts: 0, hints: 0, feedback: '', locked: false, committed: new Set() };
}
/** Returns a new question state, leaving previous question's attempt counters behind. */
export function advanceSession(session: Session): Session {
  if (session.phase !== 'solved' || session.index >= session.deck.length - 1) return session;
  const index = session.index + 1;
  return { ...session, index, attempts: 0, hints: 0, feedback: '', locked: false,
    phase: session.deck[index].visual.kind === 'memory' ? 'preview' : 'answer' };
}
/** Skill-based outcomes stay distinct from therapy-like practice and rest. */
export function attemptOutcome(attempts: number, hints: number, mode?: AnswerMode): {
  independent: boolean; earned: number; kind: 'rest' | 'practice' | 'independent' | 'supported';
} {
  if (mode === 'skip') return { independent: false, earned: 0, kind: 'rest' };
  if (mode === 'practice') return { independent: false, earned: 5, kind: 'practice' };
  const independent = attempts === 1 && hints === 0;
  return { independent, earned: independent ? 10 : 5,
    kind: independent ? 'independent' : 'supported' };
}
