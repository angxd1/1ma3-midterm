import { describe, it, expect } from 'vitest';
import type { Attempt } from '../types';
import { content, mcqById } from '../content';
import { mulberry32 } from '../mock';
import { CHAPTERS } from '../../content/types';
import { BOSS_MCQS, BOSS_FILLS, bossLength, bossOutcome, cardId, cardQueue, cardStates, checkFill, checkMatching, composeBoss, lightningPool, normalize } from '../drills';
import { isQuestion, xpFor, earnedBadges } from '../gamify';
import { pendingMistakes } from '../stats';

let n = 0;
const at = (p: Partial<Attempt>, ts: number): Attempt => ({ id: `a${++n}`, questionId: `q${n}`, conceptIds: ['c'], correct: true, confidence: 'sure', mode: 'mastery', ts, ...p });

describe('boss battle composition', () => {
  it('builds 12 MCQs + 2 fill-ins + 1 matching set from one chapter, every chapter, many seeds', () => {
    for (const ch of CHAPTERS) {
      for (let seed = 1; seed <= 25; seed++) {
        const p = composeBoss(content, ch, [], mulberry32(seed));
        expect(p.mcqIds).toHaveLength(BOSS_MCQS);
        expect(new Set(p.mcqIds).size).toBe(BOSS_MCQS);
        expect(p.fillIds).toHaveLength(BOSS_FILLS);
        expect(p.matchingId).not.toBeNull();
        expect(bossLength(p)).toBe(15);
        for (const id of p.mcqIds) {
          const q = mcqById.get(id)!;
          expect(q.chapter).toBe(ch);
          expect(q.outOfScope).toBeFalsy();
          expect(q.kind).not.toBe('recall');
          if (q.twin) expect(p.mcqIds).not.toContain(q.twin);
        }
        for (const f of p.fillIds) expect(content.fillBlanks.find((x) => x.id === f)!.chapter).toBe(ch);
      }
    }
  });

  it('covers 12 different concepts and aims at the weakest ones', () => {
    const ch = content.chapters.find((c) => c.id === 6)!;
    const weak = ch.conceptIds.slice(0, 3);
    const log = weak.flatMap((c, i) => [1, 2, 3].map((k) => at({ conceptIds: [c], correct: false }, 1000 + i * 10 + k)));
    const strong = ch.conceptIds.slice(3).flatMap((c, i) => [1, 2, 3].map((k) => at({ conceptIds: [c] }, 1000 + i * 10 + k)));
    const p = composeBoss(content, 6, [...log, ...strong], mulberry32(9), 2000);
    const concepts = p.mcqIds.map((id) => mcqById.get(id)!.concepts[0]);
    expect(new Set(concepts).size).toBe(BOSS_MCQS);
    for (const c of weak) expect(concepts).toContain(c);
  });

  it('wins only with ≥80% and a heart left', () => {
    expect(bossOutcome(12, 15, 3).won).toBe(false); // 80% but out of hearts
    expect(bossOutcome(13, 15, 2)).toMatchObject({ won: true, hearts: 1 });
    expect(bossOutcome(11, 15, 2).won).toBe(false); // 73%
  });
});

describe('fill-in and matching checks', () => {
  const f = { id: 'f', chapter: 3 as const, concepts: [], text: 'The acronym is ___.', answer: 'CDSTEP', accept: ['C.D.S.T.E.P.'], src: '' };
  it('forgives case, punctuation, articles and plurals', () => {
    expect(checkFill(f, ' cdstep ')).toBe(true);
    expect(checkFill(f, 'C.D.S.T.E.P.')).toBe(true);
    expect(checkFill(f, 'CDST')).toBe(false);
    expect(checkFill(f, '')).toBe(false);
    const g = { ...f, answer: 'generational cohort', accept: [] };
    expect(checkFill(g, 'The generational cohorts')).toBe(true);
    expect(normalize('Évoked  set!')).toBe('evoked set');
  });
  it('every authored fill-in accepts its own answer', () => {
    for (const x of content.fillBlanks) expect(checkFill(x, x.answer)).toBe(true);
  });
  it('scores matching pair by pair', () => {
    const m = content.matching[0];
    const picks = m.pairs.map(([, r]) => r);
    expect(checkMatching(m, picks).every(Boolean)).toBe(true);
    picks[0] = picks[1];
    expect(checkMatching(m, picks)[0]).toBe(false);
  });
});

describe('flashcard Leitner boxes', () => {
  const card = cardId('ch3-culture', 0);
  const rate = (rating: string, ts: number) => at({ questionId: card, conceptIds: [], mode: 'flashcard', confidence: null, meta: { rating } }, ts);
  it('good moves up a box, easy two, again resets', () => {
    const H = 3_600_000;
    let s = cardStates([rate('good', 0)]).get(card)!;
    expect(s.box).toBe(1);
    expect(s.due).toBe(12 * H);
    s = cardStates([rate('good', 0), rate('easy', 1)]).get(card)!;
    expect(s.box).toBe(3);
    s = cardStates([rate('good', 0), rate('easy', 1), rate('again', 2)]).get(card)!;
    expect(s.box).toBe(0);
    expect(s.due).toBe(2 + H / 6);
  });
  it('queues due cards before new ones, and hides cards not yet due', () => {
    const states = cardStates([at({ questionId: 'card:a:0', conceptIds: [], meta: { rating: 'good' } }, 0), at({ questionId: 'card:b:0', conceptIds: [], meta: { rating: 'again' } }, 0)]);
    const q = cardQueue(['card:a:0', 'card:b:0', 'card:c:0'], states, 20 * 60_000);
    expect(q).toEqual(['card:b:0', 'card:c:0']);
  });
});

describe('Phase 3 markers stay out of question stats', () => {
  it('flashcards and boss/lightning markers are not questions, never owed, and earn their own XP', () => {
    const card = at({ questionId: 'card:x:0', conceptIds: [], meta: { rating: 'again' } }, 1);
    const boss = at({ questionId: 'boss:3', conceptIds: [], mode: 'boss', meta: { won: true } }, 2);
    const light = at({ questionId: 'lightning:z', conceptIds: [], mode: 'lightning', meta: { score: 16 } }, 3);
    for (const a of [card, boss, light]) expect(isQuestion(a)).toBe(false);
    expect(pendingMistakes([card, boss, light])).toEqual([]);
    expect([xpFor(card), xpFor(boss), xpFor(light)]).toEqual([2, 150, 0]);
    const b = earnedBadges({ attempts: [boss, light], chapters: content.chapters, totalConcepts: 150, masteryN: 3, related: () => [], now: 10 });
    expect(b.has('boss-slayer')).toBe(true);
    expect(b.has('lightning')).toBe(true);
    expect(b.has('boss-sweep')).toBe(false);
  });

  it('lightning pool uses seen concepts once there are enough questions on them', () => {
    const all = lightningPool(content, new Set(), [...CHAPTERS]);
    expect(all.length).toBeGreaterThan(500);
    const seen = new Set(content.chapters.find((c) => c.id === 4)!.conceptIds);
    const pool = lightningPool(content, seen, [...CHAPTERS]);
    expect(pool.every((q) => seen.has(q.concepts[0]))).toBe(true);
    expect(pool.every((q) => !q.outOfScope && (q.kind === 'recall' || q.kind === 'practice'))).toBe(true);
  });
});
