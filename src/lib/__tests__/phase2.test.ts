import { describe, it, expect } from 'vitest';
import type { Attempt } from '../types';
import { xpFor, levelInfo, levelThreshold, streakInfo, bestCorrectRun, earnedBadges, totalXp } from '../gamify';
import { conceptReadiness, readiness, CHANCE } from '../readiness';
import { buildPlan, studyDays, taskComplete } from '../plan';

const DAY = 86_400_000;
let n = 0;
const at = (p: Partial<Attempt> & { questionId?: string; conceptIds?: string[]; correct?: boolean }, ts: number): Attempt => ({
  id: `a${++n}`,
  questionId: `q${n}`,
  conceptIds: ['c'],
  correct: true,
  confidence: 'sure',
  mode: 'mastery',
  ts,
  ...p,
});
/** Local-time timestamp, so day boundaries match the user's calendar. */
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('XP and levels', () => {
  it('awards XP by attempt type, with combo multiplier and half XP for correct guesses', () => {
    expect(xpFor(at({ questionId: 'lesson:c', mode: 'lesson' }, 1))).toBe(20);
    expect(xpFor(at({}, 1))).toBe(10);
    expect(xpFor(at({ confidence: 'guess' }, 1))).toBe(5);
    expect(xpFor(at({ meta: { mult: 2 } }, 1))).toBe(20);
    expect(xpFor(at({ correct: false }, 1))).toBe(1);
    expect(xpFor(at({ questionId: 'mock:x', conceptIds: [], mode: 'mock' }, 1))).toBe(100);
    expect(xpFor(at({ confidence: null, meta: { score: 4, outOf: 4 } }, 1))).toBe(30);
  });

  it('levels follow triangular thresholds (0, 100, 300, 600 …)', () => {
    expect([1, 2, 3, 4].map(levelThreshold)).toEqual([0, 100, 300, 600]);
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    const l = levelInfo(450);
    expect(l.level).toBe(3);
    expect(l.into).toBe(150);
    expect(l.span).toBe(300);
  });
});

describe('daily streak', () => {
  it('counts consecutive local days and stays alive until midnight', () => {
    const log = [local(2026, 11, 2), local(2026, 11, 3), local(2026, 11, 4)].map((ts) => at({}, ts));
    expect(streakInfo(log, local(2026, 11, 4, 20)).current).toBe(3);
    // Next day, nothing yet: still 3 (you have until midnight)…
    const s = streakInfo(log, local(2026, 11, 5, 9));
    expect(s.current).toBe(3);
    expect(s.studiedToday).toBe(false);
    // …but a missed day breaks it.
    expect(streakInfo(log, local(2026, 11, 6, 9)).current).toBe(0);
    expect(streakInfo(log, local(2026, 11, 6, 9)).best).toBe(3);
  });

  it('uses the best run when there are gaps', () => {
    const log = [1, 2, 5, 6, 7, 8].map((d) => at({}, local(2026, 10, d)));
    expect(streakInfo(log, local(2026, 10, 8)).best).toBe(4);
  });
});

describe('badges', () => {
  const chapters = [{ id: 3, conceptIds: ['c', 'd'] }];
  const ctx = (attempts: Attempt[]) => ({ attempts, chapters, totalConcepts: 2, masteryN: 3, related: () => [], now: local(2026, 11, 5) });

  it('a guess breaks a correct run', () => {
    const log = [...Array(6)].map((_, i) => at({}, i)).concat([at({ confidence: 'guess' }, 10)], [...Array(4)].map((_, i) => at({}, 20 + i)));
    expect(bestCorrectRun(log)).toBe(6);
  });

  it('earns coverage, mastery, mock and mistake badges from the log', () => {
    const log: Attempt[] = [at({ questionId: 'lesson:c', mode: 'lesson' }, 1)];
    expect([...earnedBadges(ctx(log))]).toEqual(['first-lesson']);
    log.push(...[1, 2, 3].map((i) => at({ conceptIds: ['d'] }, 10 + i)), ...[1, 2, 3].map((i) => at({ conceptIds: ['c'] }, 20 + i)));
    const b = earnedBadges(ctx(log));
    expect(b.has('explorer')).toBe(true);
    expect(b.has('cartographer')).toBe(true);
    expect(b.has('champion')).toBe(true);
    expect(b.has('rehearsal')).toBe(false);
    log.push(at({ questionId: 'mock:1', conceptIds: [], mode: 'mock', confidence: null, meta: { score: 50, of: 60 } }, 99));
    expect(earnedBadges(ctx(log)).has('exam-ready')).toBe(true);
    for (let i = 0; i < 10; i++) log.push(at({ questionId: `w${i}`, correct: false }, 100 + i), at({ questionId: `w${i}`, correct: true }, 200 + i));
    expect(earnedBadges(ctx(log)).has('slayer')).toBe(true);
  });

  it('total XP is just the sum over the log, so it merges across devices', () => {
    const a = [at({}, 1), at({ questionId: 'lesson:c', mode: 'lesson' }, 2)];
    expect(totalXp(a)).toBe(30);
  });
});

describe('readiness', () => {
  const now = local(2026, 11, 5);

  it('unseen concepts sit at chance; strong recent answers push toward 100%', () => {
    expect(conceptReadiness([], now).get('c')).toBeUndefined();
    const strong = [1, 2, 3, 4, 5, 6].map((i) => at({}, now - i * 1000));
    const p = conceptReadiness(strong, now).get('c')!;
    expect(p).toBeGreaterThan(0.85);
    expect(p).toBeLessThan(1);
  });

  it('recent answers outweigh old ones', () => {
    const improving = [at({ correct: false }, now - 5000), at({ correct: false }, now - 4000), at({}, now - 2000), at({}, now - 1000)];
    const slipping = [at({}, now - 5000), at({}, now - 4000), at({ correct: false }, now - 2000), at({ correct: false }, now - 1000)];
    expect(conceptReadiness(improving, now).get('c')!).toBeGreaterThan(conceptReadiness(slipping, now).get('c')!);
  });

  it('fades once a concept is overdue for review', () => {
    const log = [at({}, now - 1000)];
    const fresh = conceptReadiness(log, now).get('c')!;
    const later = conceptReadiness(log, now + 10 * DAY).get('c')!;
    expect(later).toBeLessThan(fresh);
    expect(later).toBeGreaterThan(CHANCE);
  });

  it('projects a score out of 60 with ~10 MCQs per chapter', () => {
    const chapters = [3, 4, 6, 7, 8, 9].map((id) => ({ id, conceptIds: [`c${id}a`, `c${id}b`] }));
    const r0 = readiness([], chapters, now);
    expect(r0.of).toBe(60);
    expect(r0.projected).toBeCloseTo(15); // all chance
    const log = [1, 2, 3, 4, 5].flatMap((i) => [at({ conceptIds: ['c3a'] }, now - i), at({ conceptIds: ['c3b'] }, now - i)]);
    const r1 = readiness(log, chapters, now);
    expect(r1.chapters.find((c) => c.id === 3)!.projected).toBeGreaterThan(8);
    expect(r1.projected).toBeGreaterThan(r0.projected);
  });

  it('ignores skipped mock questions and short answers', () => {
    const log = [at({ correct: false, mode: 'mock', meta: { skipped: true } }, now - 2), at({ correct: false, meta: { score: 0, outOf: 4 } }, now - 1)];
    expect(conceptReadiness(log, now).has('c')).toBe(false);
  });
});

describe('study plan', () => {
  const order = Array.from({ length: 12 }, (_, i) => `k${i}`);
  const base = { conceptOrder: order, masteryN: 3, examDate: '2026-11-09', related: () => [] as string[] };

  it('counts study days up to (not including) exam day', () => {
    expect(studyDays('2026-11-09', local(2026, 11, 5, 0))).toBe(4);
    expect(studyDays('2026-11-09', local(2026, 11, 8, 23))).toBe(1);
    expect(studyDays('2026-11-09', local(2026, 11, 9, 8))).toBe(0);
  });

  it('spreads lessons over all but the last day, puts the mock two days out, and keeps the last day for review', () => {
    const plan = buildPlan({ ...base, attempts: [], now: local(2026, 11, 5, 9) });
    expect(plan.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    const learned = plan.flatMap((d) => d.tasks.flatMap((t) => (t.kind === 'learn' ? t.conceptIds : [])));
    expect(learned).toEqual(order);
    expect(plan[3].tasks.some((t) => t.kind === 'learn')).toBe(false);
    expect(plan[3].tasks.some((t) => t.kind === 'final')).toBe(true);
    expect(plan.findIndex((d) => d.tasks.some((t) => t.kind === 'mock'))).toBe(2);
  });

  it("keeps today's targets fixed while today's work ticks them off", () => {
    const now = local(2026, 11, 5, 18);
    const morning = buildPlan({ ...base, attempts: [], now })[0];
    const learn = morning.tasks.find((t) => t.kind === 'learn')!;
    const todays = [at({ questionId: 'lesson:k0', conceptIds: ['k0'], mode: 'lesson' }, local(2026, 11, 5, 10)), at({ questionId: 'lesson:k1', conceptIds: ['k1'], mode: 'lesson' }, local(2026, 11, 5, 11))];
    const after = buildPlan({ ...base, attempts: todays, now })[0];
    const learn2 = after.tasks.find((t) => t.kind === 'learn')!;
    expect(learn2.kind === 'learn' && learn.kind === 'learn' && learn2.conceptIds).toEqual(learn.kind === 'learn' && learn.conceptIds);
    expect(learn2.kind === 'learn' && learn2.done).toBe(2);
  });

  it('adds a review task for mistakes owed this morning and ticks it when fixed', () => {
    const now = local(2026, 11, 5, 18);
    const log = [at({ questionId: 'x', correct: false }, local(2026, 11, 4)), at({ questionId: 'x', correct: true }, local(2026, 11, 5, 10))];
    const review = buildPlan({ ...base, attempts: log, now })[0].tasks.find((t) => t.kind === 'review')!;
    expect(review.kind === 'review' && review.target).toBe(1);
    expect(taskComplete(review)).toBe(true);
  });

  it('drops the lesson task once everything is seen and lowers practice as mastery grows', () => {
    const now = local(2026, 11, 5, 9);
    const fresh = buildPlan({ ...base, attempts: [], now })[0].tasks.find((t) => t.kind === 'practice')!;
    const mastered = order.flatMap((c) => [1, 2, 3].map((i) => at({ conceptIds: [c] }, local(2026, 11, 3) + i)));
    const plan = buildPlan({ ...base, attempts: mastered, now })[0];
    expect(plan.tasks.some((t) => t.kind === 'learn')).toBe(false);
    const prac = plan.tasks.find((t) => t.kind === 'practice')!;
    expect(prac.kind === 'practice' && fresh.kind === 'practice' && prac.target <= fresh.target).toBe(true);
  });

  it('is empty on exam day', () => {
    expect(buildPlan({ ...base, attempts: [], now: local(2026, 11, 9, 8) })).toEqual([]);
  });
});
