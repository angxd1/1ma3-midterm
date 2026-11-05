import type { Attempt } from './types';
import { buildSchedules } from './scheduler';
import { isQuestion } from './gamify';

const DAY = 86_400_000;
export const CHANCE = 0.25; // 4-option MCQ
const RECENT = 8; // attempts per concept that count
const DECAY = 0.7; // each older attempt counts 70% as much as the next newer one
const PRIOR_W = 0.5; // half a pseudo-attempt at "don't know yet"

/**
 * Probability of answering a fresh MCQ on each concept correctly.
 *  - knowledge = recency-weighted score of the last few attempts (correct 1,
 *    correct guess 0.5, wrong 0), shrunk toward 0 by half a pseudo-attempt
 *  - forgetting: once a concept is past its spaced-repetition due date, the
 *    knowledge fades (halved after one extra interval)
 *  - P(correct) = chance + (1 − chance) × knowledge, so an unseen concept is 25%
 */
export function conceptReadiness(attempts: Attempt[], now: number): Map<string, number> {
  const per = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!isQuestion(a) || typeof a.meta?.outOf === 'number' || a.meta?.skipped) continue;
    for (const c of a.conceptIds) per.set(c, [...(per.get(c) ?? []), a]);
  }
  const schedules = buildSchedules(attempts);
  const out = new Map<string, number>();
  for (const [c, list] of per) {
    const recent = list.sort((x, y) => y.ts - x.ts).slice(0, RECENT);
    let num = 0;
    let den = PRIOR_W;
    recent.forEach((a, i) => {
      const w = DECAY ** i;
      num += w * (a.correct ? (a.confidence === 'guess' ? 0.5 : 1) : 0);
      den += w;
    });
    let know = num / den;
    const s = schedules.get(c);
    if (s && now > s.due) know /= 1 + (now - s.due) / (Math.max(s.interval, 1) * DAY);
    out.set(c, CHANCE + (1 - CHANCE) * know);
  }
  return out;
}

export interface Readiness {
  /** Projected MCQ score out of 60 (each chapter ≈ 10 questions, concepts weighted equally within a chapter). */
  projected: number;
  of: number;
  pct: number;
  chapters: { id: number; projected: number; of: number; seenShare: number }[];
  weakest: { conceptId: string; p: number }[];
  /** Share of concepts with ≥ 3 answers — how much evidence the estimate rests on. */
  evidence: number;
}

export function readiness(attempts: Attempt[], chapters: { id: number; conceptIds: string[] }[], now: number, perChapter = 10): Readiness {
  const p = conceptReadiness(attempts, now);
  const counts = new Map<string, number>();
  for (const a of attempts) if (isQuestion(a)) for (const c of a.conceptIds) counts.set(c, (counts.get(c) ?? 0) + 1);
  const all = chapters.flatMap((ch) => ch.conceptIds);
  const rows = chapters.map((ch) => {
    const ps = ch.conceptIds.map((c) => p.get(c) ?? CHANCE);
    const mean = ps.reduce((s, x) => s + x, 0) / (ps.length || 1);
    return { id: ch.id, projected: mean * perChapter, of: perChapter, seenShare: ch.conceptIds.filter((c) => p.has(c)).length / (ch.conceptIds.length || 1) };
  });
  const projected = rows.reduce((s, r) => s + r.projected, 0);
  const of = perChapter * chapters.length;
  const weakest = all
    .filter((c) => p.has(c))
    .map((c) => ({ conceptId: c, p: p.get(c)! }))
    .sort((a, b) => a.p - b.p)
    .slice(0, 5);
  return { projected, of, pct: projected / of, chapters: rows, weakest, evidence: all.filter((c) => (counts.get(c) ?? 0) >= 3).length / (all.length || 1) };
}
