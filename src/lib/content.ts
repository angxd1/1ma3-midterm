import raw from '../data/content.json';
import { pendingMistakes } from './stats';
import type { Attempt } from './types';
import type { ChapterId, Concept, ContentBundle, Mcq, ShortAnswer } from '../content/types';

export const content = raw as unknown as ContentBundle;

export const conceptById = new Map<string, Concept>(content.concepts.map((c) => [c.id, c]));
export const mcqById = new Map<string, Mcq>(content.mcqs.map((q) => [q.id, q]));
export const saById = new Map<string, ShortAnswer>(content.shortAnswers.map((s) => [s.id, s]));
export const chapterById = new Map(content.chapters.map((c) => [c.id, c]));

export const CHAPTER_SHORT: Record<ChapterId, string> = {
  3: 'Marketing Environment',
  4: 'Consumer Behaviour',
  6: 'STP',
  7: 'Marketing Research',
  8: 'New Products',
  9: 'Product & Branding',
};

/** Questions that count as "the same idea" (siblings + twin) — used to clear owed mistakes. */
export function relatedIds(qid: string): string[] {
  const q = mcqById.get(qid);
  if (!q) return [];
  return [...q.siblings, ...(q.twin ? [q.twin] : [])];
}

/** Owed mistakes that the MCQ review flows can serve (excludes short answers, matching and fill-ins). */
export const owedMcqs = (attempts: Attempt[]) => pendingMistakes(attempts, relatedIds).filter((id) => mcqById.has(id));

/** MCQs eligible for practice/mock (excludes out-of-scope officials). */
export const scopedMcqs = content.mcqs.filter((q) => !q.outOfScope);

/** Options with letters/"all of the above" can't be shuffled without breaking meaning. */
export function canShuffle(q: Mcq): boolean {
  return !q.options.some((o) => /\b(all|none) of the above\b|\b(both )?[a-f] (&|and) [a-f]\b|^both [a-f]/i.test(o));
}
