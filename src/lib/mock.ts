import type { ChapterId, ContentBundle, Mcq, ShortAnswer } from '../content/types';
import { CHAPTERS } from '../content/types';
import type { Attempt } from './types';
import { conceptAccuracy, pendingMistakes } from './stats';

export const MOCK_MCQS = 60;
export const MOCK_MINUTES = 120;
export const MAX_PER_CONCEPT = 3; // keep the paper broad even when one concept is very weak
export const SA_OTHER_CHAPTERS: ChapterId[] = [3, 6, 8, 9]; // never Chapter 7

export interface MockPaper {
  id: string;
  mcqIds: string[];
  saIds: [string, string];
  createdAt: number;
}

/** Simple seeded PRNG so tests are deterministic. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a Version B paper:
 *  - 60 MCQs, ~10 per chapter (spread evenly; remainder goes to the largest pools)
 *  - within each chapter: owed mistakes first, then official/past-midterm questions,
 *    then questions on the weakest concepts, then random fill
 *  - at most 3 questions per concept; never both halves of a twin pair; out-of-scope questions excluded
 *  - short answers: one from Ch 4, one from Ch 3/6/8/9 (never Ch 7)
 */
export function composeMock(
  bundle: ContentBundle,
  attempts: Attempt[],
  rand: () => number = Math.random,
  related: (qid: string) => string[] = () => [],
): MockPaper {
  const pool = bundle.mcqs.filter((q) => !q.outOfScope && (q.kind === 'practice' || q.kind === 'official' || q.kind === 'example' || q.kind === 'confusable'));
  const owed = new Set(pendingMistakes(attempts, related));
  const acc = conceptAccuracy(attempts);
  const weakness = (q: Mcq) =>
    Math.max(...q.concepts.map((c) => {
      const r = acc.get(c);
      return r ? 1 - (r.right + 1) / (r.total + 2) : 0.5;
    }), 0);

  const perChapter = Math.floor(MOCK_MCQS / CHAPTERS.length);
  let extra = MOCK_MCQS - perChapter * CHAPTERS.length;
  const chosen: string[] = [];
  const blocked = new Set<string>();
  const perConcept = new Map<string, number>();
  const take = (q: Mcq) => {
    if (blocked.has(q.id) || chosen.includes(q.id)) return false;
    const c = q.concepts[0] ?? q.id;
    if ((perConcept.get(c) ?? 0) >= MAX_PER_CONCEPT) return false;
    perConcept.set(c, (perConcept.get(c) ?? 0) + 1);
    chosen.push(q.id);
    blocked.add(q.id);
    if (q.twin) blocked.add(q.twin);
    return true;
  };

  for (const ch of CHAPTERS) {
    let quota = perChapter + (extra-- > 0 ? 1 : 0);
    const chPool = shuffle(pool.filter((q) => q.chapter === ch), rand);
    const ranked = [
      ...chPool.filter((q) => owed.has(q.id)),
      ...chPool.filter((q) => q.official && !owed.has(q.id)).slice(0, 3),
      ...[...chPool].sort((a, b) => weakness(b) - weakness(a)).slice(0, quota),
      ...chPool,
    ];
    // Owed mistakes may use at most half the chapter quota so the paper stays broad.
    let owedUsed = 0;
    for (const q of ranked) {
      if (quota <= 0) break;
      if (owed.has(q.id)) {
        if (owedUsed >= Math.ceil(perChapter / 2)) continue;
        if (take(q)) { owedUsed++; quota--; }
      } else if (take(q)) quota--;
    }
  }

  const sa = (chs: ChapterId[]) => {
    const list = bundle.shortAnswers.filter((s) => chs.includes(s.chapter));
    return list[Math.floor(rand() * list.length)] as ShortAnswer;
  };
  return {
    id: `mock-${Date.now().toString(36)}-${Math.floor(rand() * 1e6).toString(36)}`,
    mcqIds: shuffle(chosen, rand),
    saIds: [sa([4]).id, sa(SA_OTHER_CHAPTERS).id],
    createdAt: Date.now(),
  };
}
