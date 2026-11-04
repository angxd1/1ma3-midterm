import { describe, it, expect } from 'vitest';
import type { Attempt } from '../types';
import { seenConcepts, masteryCounts, masteredConcepts, chapterProgress, pendingMistakes, mergeAttempts } from '../stats';
import { buildSchedules, conceptWeight, quality } from '../scheduler';
import { composeMock, mulberry32, MOCK_MCQS } from '../mock';
import { mergeKv } from '../sync';
import { checkRubric, containsPhrase } from '../keywords';
import { content, relatedIds, mcqById, saById } from '../content';
import { CHAPTERS } from '../../content/types';

const DAY = 86_400_000;
let n = 0;
const at = (p: Partial<Attempt> & { questionId: string; conceptIds: string[]; correct: boolean }, ts = 1_000 + n): Attempt => ({
  id: `a${++n}`,
  confidence: 'sure',
  mode: 'mastery',
  ts,
  ...p,
});

describe('coverage', () => {
  it('counts a concept as seen after a lesson or any question in any mode', () => {
    const s = seenConcepts([
      at({ questionId: 'lesson:c1', conceptIds: ['c1'], correct: true, mode: 'lesson' }),
      at({ questionId: 'q2', conceptIds: ['c2'], correct: false, mode: 'mock' }),
    ]);
    expect([...s].sort()).toEqual(['c1', 'c2']);
  });
});

describe('mastery', () => {
  it('requires N correct answers (any days); lessons and guesses do not count', () => {
    const log = [
      at({ questionId: 'lesson:c', conceptIds: ['c'], correct: true, mode: 'lesson' }),
      at({ questionId: 'q1', conceptIds: ['c'], correct: true }),
      at({ questionId: 'q2', conceptIds: ['c'], correct: true, confidence: 'guess' }),
      at({ questionId: 'q3', conceptIds: ['c'], correct: true }),
    ];
    expect(masteryCounts(log, 3).get('c')).toBe(2);
    expect(masteredConcepts(log, 3).has('c')).toBe(false);
    log.push(at({ questionId: 'q1', conceptIds: ['c'], correct: true }));
    expect(masteredConcepts(log, 3).has('c')).toBe(true);
  });

  it('lapses when a wrong answer comes after mastery', () => {
    const log = [1, 2, 3].map((i) => at({ questionId: `q${i}`, conceptIds: ['c'], correct: true }));
    expect(masteredConcepts(log, 3).has('c')).toBe(true);
    log.push(at({ questionId: 'q4', conceptIds: ['c'], correct: false }));
    expect(masteredConcepts(log, 3).has('c')).toBe(false);
    expect(masteryCounts(log, 3).get('c')).toBe(2);
  });

  it('wrong answers before mastery do not reduce the count', () => {
    const log = [
      at({ questionId: 'q1', conceptIds: ['c'], correct: true }),
      at({ questionId: 'q2', conceptIds: ['c'], correct: false }),
    ];
    expect(masteryCounts(log, 3).get('c')).toBe(1);
  });

  it('respects a configurable threshold', () => {
    const log = [1, 2, 3, 4].map((i) => at({ questionId: `q${i}`, conceptIds: ['c'], correct: true }));
    expect(masteredConcepts(log, 5).has('c')).toBe(false);
    expect(masteredConcepts(log, 4).has('c')).toBe(true);
  });

  it('chapter progress reports coverage and mastery fractions', () => {
    const log = [1, 2, 3].map((i) => at({ questionId: `q${i}`, conceptIds: ['a'], correct: true }));
    log.push(at({ questionId: 'lesson:b', conceptIds: ['b'], correct: true, mode: 'lesson' }));
    const p = chapterProgress(['a', 'b', 'c', 'd'], log, 3);
    expect(p.coverage).toBe(0.5);
    expect(p.mastery).toBe(0.25);
  });
});

describe('adaptive scheduler', () => {
  it('treats a correct guess as weak (quality < 3)', () => {
    expect(quality(at({ questionId: 'q', conceptIds: ['c'], correct: true, confidence: 'guess' }))).toBeLessThan(3);
    expect(quality(at({ questionId: 'q', conceptIds: ['c'], correct: true, confidence: 'sure' }))).toBe(5);
  });

  it('grows the interval with consecutive successful days and resets on failure', () => {
    const log = [0, 1, 4].map((d) => at({ questionId: 'q', conceptIds: ['c'], correct: true }, d * DAY + 10));
    const s1 = buildSchedules(log).get('c')!;
    expect(s1.reps).toBe(3);
    expect(s1.interval).toBeGreaterThan(3);
    log.push(at({ questionId: 'q', conceptIds: ['c'], correct: false }, 12 * DAY));
    const s2 = buildSchedules(log).get('c')!;
    expect(s2.reps).toBe(0);
    expect(s2.interval).toBe(1);
  });

  it('weights weak concepts above strong ones, and overdue above freshly reviewed', () => {
    const now = 30 * DAY;
    const weak = buildSchedules([1, 2, 3].map((i) => at({ questionId: `w${i}`, conceptIds: ['w'], correct: false }, now - i * 1000))).get('w');
    const strong = buildSchedules([1, 2, 3].map((i) => at({ questionId: `s${i}`, conceptIds: ['s'], correct: true }, now - i * 1000))).get('s');
    expect(conceptWeight(weak, now)).toBeGreaterThan(conceptWeight(strong, now));
    expect(conceptWeight(strong, now + 60 * DAY)).toBeGreaterThan(conceptWeight(strong, now));
  });

  it('keeps a wrong answer owed until it (or a related question) is answered correctly later', () => {
    const log = [at({ questionId: 'q1', conceptIds: ['c'], correct: false }, 100)];
    expect(pendingMistakes(log)).toEqual(['q1']);
    expect(pendingMistakes([...log, at({ questionId: 'q2', conceptIds: ['c'], correct: true }, 200)], () => ['q2'])).toEqual([]);
    expect(pendingMistakes([...log, at({ questionId: 'q1', conceptIds: ['c'], correct: true }, 300)])).toEqual([]);
  });
});

describe('Version B composition', () => {
  const paper = composeMock(content, [], mulberry32(42), relatedIds);

  it('has exactly 60 unique MCQs spread ~10 per chapter', () => {
    expect(paper.mcqIds).toHaveLength(MOCK_MCQS);
    expect(new Set(paper.mcqIds).size).toBe(MOCK_MCQS);
    for (const ch of CHAPTERS) {
      const k = paper.mcqIds.filter((id) => mcqById.get(id)!.chapter === ch).length;
      expect(k).toBeGreaterThanOrEqual(9);
      expect(k).toBeLessThanOrEqual(11);
    }
  });

  it('never includes out-of-scope questions or both halves of a twin', () => {
    for (const id of paper.mcqIds) {
      const q = mcqById.get(id)!;
      expect(q.outOfScope).toBeFalsy();
      if (q.twin) expect(paper.mcqIds).not.toContain(q.twin);
    }
  });

  it('mixes in official questions', () => {
    expect(paper.mcqIds.some((id) => mcqById.get(id)!.official)).toBe(true);
  });

  it('short answers: one from Ch 4, the other from Ch 3/6/8/9, never Ch 7', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = composeMock(content, [], mulberry32(seed));
      expect(saById.get(p.saIds[0])!.chapter).toBe(4);
      expect([3, 6, 8, 9]).toContain(saById.get(p.saIds[1])!.chapter);
    }
  });

  it('caps any one concept at 3 questions even when many on it were missed', () => {
    const many = content.mcqs.filter((q) => q.concepts[0] === 'ch6-psychographic' && q.kind !== 'recall');
    const log = many.map((q, i) => at({ questionId: q.id, conceptIds: q.concepts, correct: false }, 100 + i));
    const p = composeMock(content, log, mulberry32(3));
    expect(p.mcqIds.filter((id) => mcqById.get(id)!.concepts[0] === 'ch6-psychographic').length).toBeLessThanOrEqual(3);
  });

  it('prioritises questions previously answered wrong', () => {
    const wrong = content.chapters.find((c) => c.id === 6)!.conceptIds.slice(0, 4).map((cid) => content.mcqs.find((q) => q.kind === 'practice' && q.concepts[0] === cid)!);
    const log = wrong.map((q, i) => at({ questionId: q.id, conceptIds: q.concepts, correct: false }, 100 + i));
    const p = composeMock(content, log, mulberry32(7));
    for (const q of wrong) expect(p.mcqIds).toContain(q.id);
  });
});

describe('sync merging', () => {
  it('unions attempt logs by id without duplicates, sorted by time', () => {
    const a = at({ questionId: 'q1', conceptIds: ['c'], correct: true }, 5);
    const b = at({ questionId: 'q2', conceptIds: ['c'], correct: false }, 3);
    const c = at({ questionId: 'q3', conceptIds: ['c'], correct: true }, 9);
    const merged = mergeAttempts([a, b], [b, c]);
    expect(merged.map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    expect(mergeAttempts(merged, merged)).toHaveLength(3);
  });

  it('is commutative, so device order does not matter', () => {
    const d1 = [1, 2].map((i) => at({ questionId: `x${i}`, conceptIds: ['c'], correct: true }, i * 10));
    const d2 = [3, 4].map((i) => at({ questionId: `y${i}`, conceptIds: ['c'], correct: true }, i * 7));
    expect(mergeAttempts(d1, d2)).toEqual(mergeAttempts(d2, d1));
  });

  it('settings use last-write-wins', () => {
    expect(mergeKv({ value: 'old', updatedAt: 1 }, { value: 'new', updatedAt: 2 })?.value).toBe('new');
    expect(mergeKv({ value: 'local', updatedAt: 5 }, { value: 'remote', updatedAt: 2 })?.value).toBe('local');
    expect(mergeKv(undefined, { value: 'r', updatedAt: 1 })?.value).toBe('r');
  });
});

describe('short-answer keyword assist', () => {
  it('matches stems and synonyms case-insensitively', () => {
    expect(containsPhrase('Consumers SEGMENTED by demographics', 'segment')).toBe(true);
    expect(containsPhrase('they felt buyer\'s remorse', 'dissonance')).toBe(false);
    const res = checkRubric('Postpurchase dissonance is buyer\'s remorse; satisfied customers become loyal.', [
      { point: 'postpurchase', keywords: ['postpurchase|post-purchase', 'satisf', 'dissonance|remorse|loyal'] },
      { point: 'search', keywords: ['internal', 'external'] },
    ]);
    expect(res[0].detected).toBe(true);
    expect(res[1].detected).toBe(false);
    expect(res[1].missing).toEqual(['internal', 'external']);
  });
});
