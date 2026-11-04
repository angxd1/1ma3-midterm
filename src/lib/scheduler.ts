import type { Attempt } from './types';
import { isLesson } from './stats';

const DAY = 86_400_000;

export interface ConceptSchedule {
  ef: number; // SM-2 easiness factor
  reps: number; // consecutive successful reviews
  interval: number; // days
  lastTs: number;
  due: number; // epoch ms
  right: number;
  total: number;
}

/** SM-2 quality from an attempt. A correct "guess" counts as a failure (weak). */
export function quality(a: Attempt): number {
  if (!a.correct) return 1;
  if (a.confidence === 'guess') return 2;
  if (a.confidence === 'unsure') return 4;
  return 5;
}

/**
 * SM-2 schedule per concept, replayed from the attempt log. Several attempts on
 * the same concept within the same day only count once (the last one wins) so a
 * burst of practice doesn't inflate the interval.
 */
export function buildSchedules(attempts: Attempt[]): Map<string, ConceptSchedule> {
  const perConcept = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (isLesson(a)) continue;
    for (const c of a.conceptIds) {
      const arr = perConcept.get(c) ?? [];
      arr.push(a);
      perConcept.set(c, arr);
    }
  }
  const out = new Map<string, ConceptSchedule>();
  for (const [c, list] of perConcept) {
    list.sort((x, y) => x.ts - y.ts);
    const s: ConceptSchedule = { ef: 2.5, reps: 0, interval: 0, lastTs: 0, due: 0, right: 0, total: 0 };
    let lastDay = -1;
    let dayQ = 5;
    const commit = () => {
      if (lastDay < 0) return;
      if (dayQ < 3) {
        s.reps = 0;
        s.interval = 1;
      } else {
        s.reps += 1;
        s.interval = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round(s.interval * s.ef);
      }
      s.ef = Math.max(1.3, s.ef + (0.1 - (5 - dayQ) * (0.08 + (5 - dayQ) * 0.02)));
    };
    for (const a of list) {
      const day = Math.floor(a.ts / DAY);
      if (day !== lastDay) {
        commit();
        lastDay = day;
        dayQ = quality(a);
      } else {
        dayQ = Math.min(dayQ, quality(a)); // any slip that day counts
      }
      s.lastTs = a.ts;
      s.total += 1;
      if (a.correct && a.confidence !== 'guess') s.right += 1;
    }
    commit();
    s.due = s.lastTs + s.interval * DAY;
    out.set(c, s);
  }
  return out;
}

/**
 * Priority weight for picking a concept in Version A. Combines:
 *  - weakness: 1 − smoothed accuracy (Laplace prior so unseen ≈ 0.5)
 *  - spaced repetition: how overdue the concept is relative to its interval
 *  - a bonus for never-practised concepts so coverage grows
 */
export function conceptWeight(s: ConceptSchedule | undefined, now: number): number {
  if (!s) return 1.2;
  const accuracy = (s.right + 1) / (s.total + 2);
  const weakness = 1 - accuracy;
  const intervalMs = Math.max(s.interval, 1) * DAY;
  const overdue = (now - s.lastTs) / intervalMs; // 1 = exactly due
  const srs = Math.min(Math.max(overdue - 0.8, 0), 2); // ramps up just before due
  return 0.15 + 1.6 * weakness + 0.9 * srs;
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rand: () => number = Math.random): T | undefined {
  const ws = items.map((t) => Math.max(weight(t), 0));
  const total = ws.reduce((x, y) => x + y, 0);
  if (!items.length || total <= 0) return items[0];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
