import type { Attempt } from './types';
import { masteryCounts, pendingMistakes, seenConcepts } from './stats';
import { dayKey, isMockMarker, isQuestion, startOfDay } from './gamify';

/**
 * Countdown study plan. Each day's targets are computed from progress as of
 * that day's midnight, so today's plan doesn't shrink while you work through it;
 * today's attempts then tick the tasks off. Future days are re-planned from
 * what's left every morning.
 */

export type PlanTask =
  | { kind: 'learn'; conceptIds: string[]; done: number }
  | { kind: 'practice'; target: number; done: number }
  | { kind: 'review'; target: number; done: number }
  | { kind: 'mock'; done: boolean }
  | { kind: 'final' };

export interface PlanDay {
  date: string; // YYYY-MM-DD
  index: number; // 0 = today
  tasks: PlanTask[];
}

export interface PlanInput {
  attempts: Attempt[];
  conceptOrder: string[]; // learning-path order across chapters
  masteryN: number;
  examDate: string; // YYYY-MM-DD
  now: number;
  related: (qid: string) => string[];
}

const PER_CONCEPT_FACTOR = 1.4; // misses mean ~1.4 questions per mastery point
const round5 = (n: number) => Math.round(n / 5) * 5;

export function examStart(examDate: string): number {
  const [y, m, d] = examDate.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Study days before the exam, today included (exam day itself excluded). */
export function studyDays(examDate: string, now: number): number {
  return Math.max(0, Math.round((examStart(examDate) - startOfDay(now)) / 86_400_000));
}

export function buildPlan(p: PlanInput): PlanDay[] {
  const today0 = startOfDay(p.now);
  const before = p.attempts.filter((a) => a.ts < today0);
  const todays = p.attempts.filter((a) => a.ts >= today0);
  const n = studyDays(p.examDate, p.now);
  if (n === 0) return [];

  // Work remaining as of this morning.
  const seenBefore = seenConcepts(before);
  const unseen = p.conceptOrder.filter((c) => !seenBefore.has(c));
  const counts = masteryCounts(before, p.masteryN);
  const masteryNeed = p.conceptOrder.reduce((s, c) => s + Math.max(0, p.masteryN - (counts.get(c) ?? 0)), 0);
  const owedMorning = pendingMistakes(before, p.related);
  const mockBefore = before.some(isMockMarker);

  // Lessons go in the first n−1 days so the final day is pure review.
  const learnDays = n >= 2 ? n - 1 : 1;
  const perDay = Math.ceil(unseen.length / learnDays);
  const practicePerDay = Math.min(150, Math.max(20, round5((masteryNeed * PER_CONCEPT_FACTOR) / n)));
  const mockDay = n >= 2 ? n - 2 : mockBefore ? -1 : 0;

  // Today's progress.
  const seenNow = seenConcepts(p.attempts);
  const owedNow = new Set(pendingMistakes(p.attempts, p.related));
  const answeredToday = todays.filter((a) => isQuestion(a) && a.mode !== 'mock').length;
  const mockToday = todays.some(isMockMarker);

  const days: PlanDay[] = [];
  for (let i = 0; i < n; i++) {
    const date = dayKey(today0 + i * 86_400_000 + 12 * 3_600_000);
    const tasks: PlanTask[] = [];
    const learn = unseen.slice(i * perDay, (i + 1) * perDay);
    if (learn.length && i < learnDays) tasks.push({ kind: 'learn', conceptIds: learn, done: i === 0 ? learn.filter((c) => seenNow.has(c)).length : 0 });
    const last = i === n - 1 && n >= 2;
    const target = last ? Math.max(20, round5(practicePerDay / 2)) : practicePerDay;
    tasks.push({ kind: 'practice', target, done: i === 0 ? Math.min(answeredToday, target) : 0 });
    if (i === 0 && owedMorning.length) tasks.push({ kind: 'review', target: owedMorning.length, done: owedMorning.filter((q) => !owedNow.has(q)).length });
    else if (i > 0) tasks.push({ kind: 'review', target: 0, done: 0 });
    if (i === mockDay) tasks.push({ kind: 'mock', done: i === 0 && mockToday });
    if (last) tasks.push({ kind: 'final' });
    days.push({ date, index: i, tasks });
  }
  return days;
}

export function taskComplete(t: PlanTask): boolean {
  switch (t.kind) {
    case 'learn':
      return t.done >= t.conceptIds.length;
    case 'practice':
    case 'review':
      return t.done >= t.target;
    case 'mock':
      return t.done;
    case 'final':
      return false;
  }
}
