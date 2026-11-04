import type { ChapterId, Mcq } from '../content/types';
import type { Attempt } from './types';
import { buildSchedules, conceptWeight, weightedPick } from './scheduler';
import { pendingMistakes } from './stats';

export interface PracticeSession {
  chapters: ChapterId[];
  asked: string[]; // question ids asked this session, in order
  blocked: string[]; // twins of asked questions
  requeue: { qid: string; due: number }[]; // wrong answers to re-ask after `due` more questions
  owed: string[]; // mistakes carried over from earlier sessions
  count: number;
}

export function newSession(chapters: ChapterId[], attempts: Attempt[], mcqs: Mcq[], related: (q: string) => string[]): PracticeSession {
  const pool = new Set(mcqs.filter((q) => chapters.includes(q.chapter)).map((q) => q.id));
  const owed = pendingMistakes(attempts, related).filter((id) => pool.has(id));
  return { chapters, asked: [], blocked: [], requeue: [], owed, count: 0 };
}

/** After a wrong answer, schedule the same question or one of its siblings 3–5 questions later. */
export function requeueWrong(s: PracticeSession, q: Mcq, rand: () => number = Math.random): PracticeSession {
  const options = [q.id, ...q.siblings];
  const qid = options[Math.floor(rand() * options.length)];
  return { ...s, requeue: [...s.requeue, { qid, due: s.count + 3 + Math.floor(rand() * 3) }] };
}

/**
 * Picks the next question for Version A:
 *  1. a re-queued wrong answer that's come due this session
 *  2. every third question, a mistake owed from a previous session
 *  3. otherwise: choose a concept by weakness + spaced-repetition weight, then
 *     a question on it that hasn't been asked this session (prefer never-answered)
 */
export function pickNext(
  s: PracticeSession,
  attempts: Attempt[],
  mcqs: Mcq[],
  now: number,
  rand: () => number = Math.random,
): { qid: string; session: PracticeSession; reason: 'requeue' | 'owed' | 'adaptive' } | null {
  const byId = new Map(mcqs.map((q) => [q.id, q]));
  const ok = (id: string) => byId.has(id) && !s.blocked.includes(id) && s.asked[s.asked.length - 1] !== id;
  const advance = (qid: string, extra: Partial<PracticeSession>, reason: 'requeue' | 'owed' | 'adaptive') => {
    const q = byId.get(qid)!;
    return {
      qid,
      reason,
      session: { ...s, ...extra, asked: [...s.asked, qid], blocked: q.twin ? [...s.blocked, q.twin] : s.blocked, count: s.count + 1 },
    };
  };

  const due = s.requeue.find((r) => r.due <= s.count && ok(r.qid));
  if (due) return advance(due.qid, { requeue: s.requeue.filter((r) => r !== due) }, 'requeue');

  if (s.owed.length && s.count % 3 === 0) {
    const qid = s.owed.find((id) => ok(id) && !s.asked.includes(id));
    if (qid) return advance(qid, { owed: s.owed.filter((x) => x !== qid) }, 'owed');
  }

  const pool = mcqs.filter((q) => s.chapters.includes(q.chapter) && !q.outOfScope);
  if (!pool.length) return null;
  const schedules = buildSchedules(attempts);
  const concepts = [...new Set(pool.flatMap((q) => q.concepts.slice(0, 1)))];
  const everAnswered = new Set(attempts.map((a) => a.questionId));
  for (let tries = 0; tries < 6; tries++) {
    const concept = weightedPick(concepts, (c) => conceptWeight(schedules.get(c), now), rand);
    const candidates = pool.filter((q) => q.concepts[0] === concept && !s.asked.includes(q.id) && ok(q.id));
    if (!candidates.length) continue;
    const fresh = candidates.filter((q) => !everAnswered.has(q.id));
    const list = fresh.length ? fresh : candidates;
    return advance(list[Math.floor(rand() * list.length)].id, {}, 'adaptive');
  }
  // Everything on the chosen concepts was asked — fall back to any unasked question.
  const rest = pool.filter((q) => !s.asked.includes(q.id) && ok(q.id));
  const any = rest.length ? rest : pool.filter((q) => ok(q.id));
  return any.length ? advance(any[Math.floor(rand() * any.length)].id, {}, 'adaptive') : null;
}

export function comboMultiplier(streak: number): number {
  return Math.min(1 + Math.floor(streak / 3) * 0.5, 3);
}
