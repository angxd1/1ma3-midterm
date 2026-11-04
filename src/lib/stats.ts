import type { Attempt } from './types';

export const isLesson = (a: Attempt) => a.questionId.startsWith('lesson:');

const byTime = (a: Attempt, b: Attempt) => a.ts - b.ts || a.id.localeCompare(b.id);

/** Concepts the user has seen: lesson completed OR any question tagged with it answered (any mode). */
export function seenConcepts(attempts: Attempt[]): Set<string> {
  const s = new Set<string>();
  for (const a of attempts) for (const c of a.conceptIds) s.add(c);
  return s;
}

/**
 * Mastery count per concept, replayed in time order:
 *  - a correct answer (not marked "guess") adds 1
 *  - a wrong answer once the concept has reached N subtracts 1, so mastery can lapse
 * Lessons don't count. A concept is mastered when its count ≥ N.
 */
export function masteryCounts(attempts: Attempt[], n: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of [...attempts].sort(byTime)) {
    if (isLesson(a)) continue;
    for (const c of a.conceptIds) {
      const cur = counts.get(c) ?? 0;
      if (a.correct) {
        if (a.confidence !== 'guess') counts.set(c, cur + 1);
      } else if (cur >= n) {
        counts.set(c, cur - 1);
      } else if (!counts.has(c)) {
        counts.set(c, 0);
      }
    }
  }
  return counts;
}

export function masteredConcepts(attempts: Attempt[], n: number): Set<string> {
  const s = new Set<string>();
  for (const [c, k] of masteryCounts(attempts, n)) if (k >= n) s.add(c);
  return s;
}

export function chapterProgress(conceptIds: string[], attempts: Attempt[], n: number) {
  const seen = seenConcepts(attempts);
  const mastered = masteredConcepts(attempts, n);
  const total = conceptIds.length || 1;
  const seenN = conceptIds.filter((c) => seen.has(c)).length;
  const masteredN = conceptIds.filter((c) => mastered.has(c)).length;
  return { seen: seenN, mastered: masteredN, total: conceptIds.length, coverage: seenN / total, mastery: masteredN / total };
}

/** Per-concept accuracy (question attempts only). */
export function conceptAccuracy(attempts: Attempt[]): Map<string, { right: number; total: number }> {
  const m = new Map<string, { right: number; total: number }>();
  for (const a of attempts) {
    if (isLesson(a)) continue;
    for (const c of a.conceptIds) {
      const r = m.get(c) ?? { right: 0, total: 0 };
      r.total++;
      if (a.correct && a.confidence !== 'guess') r.right++;
      m.set(c, r);
    }
  }
  return m;
}

/**
 * Questions still "owed": the latest attempt at the question (or any of its
 * siblings/twin, if answered later) was wrong. These come back in Version A and B.
 */
export function pendingMistakes(attempts: Attempt[], related: (qid: string) => string[] = () => []): string[] {
  const last = new Map<string, Attempt>();
  for (const a of [...attempts].sort(byTime)) if (!isLesson(a)) last.set(a.questionId, a);
  const out: string[] = [];
  for (const [qid, a] of last) {
    if (a.correct) continue;
    const fixedLater = related(qid).some((r) => {
      const ra = last.get(r);
      return ra && ra.correct && ra.ts > a.ts;
    });
    if (!fixedLater) out.push(qid);
  }
  return out;
}

/** Everything ever answered wrong (for the mistake notebook). */
export function everWrong(attempts: Attempt[]): Set<string> {
  return new Set(attempts.filter((a) => !a.correct && !isLesson(a)).map((a) => a.questionId));
}

/** Merge two attempt logs (sync): union by id, sorted by time. */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const m = new Map<string, Attempt>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort(byTime);
}
