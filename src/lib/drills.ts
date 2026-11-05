import type { ChapterId, ContentBundle, FillBlank, Matching, Mcq } from '../content/types';
import type { Attempt } from './types';
import { buildSchedules, conceptWeight } from './scheduler';

/* ---------------- Boss battle ---------------- */

export const BOSS_MCQS = 12;
export const BOSS_FILLS = 2;
export const BOSS_HEARTS = 3;
export const BOSS_PASS = 0.8;

export interface BossPaper {
  chapter: ChapterId;
  mcqIds: string[];
  matchingId: string | null;
  fillIds: string[];
}

/**
 * A chapter "boss": 12 MCQs (one per concept, weakest concepts first, harder
 * questions preferred, twins never together), one matching set and two
 * fill-in-the-blanks. Out-of-scope officials and recall questions are excluded.
 */
export function composeBoss(bundle: ContentBundle, chapter: ChapterId, attempts: Attempt[], rand: () => number, now = Date.now()): BossPaper {
  const pool = bundle.mcqs.filter((q) => q.chapter === chapter && !q.outOfScope && q.kind !== 'recall' && q.kind !== 'confusable');
  const schedules = buildSchedules(attempts);
  const conceptIds = bundle.chapters.find((c) => c.id === chapter)?.conceptIds ?? [];
  const ranked = [...conceptIds].sort((a, b) => conceptWeight(schedules.get(b), now) - conceptWeight(schedules.get(a), now) || rand() - 0.5);
  const picked: Mcq[] = [];
  const blocked = new Set<string>();
  const take = (q: Mcq) => {
    picked.push(q);
    blocked.add(q.id);
    if (q.twin) blocked.add(q.twin);
  };
  // Pass 1: one per concept in weakness order; pass 2 fills any shortfall.
  for (const c of ranked) {
    if (picked.length >= BOSS_MCQS) break;
    const cands = pool.filter((q) => q.concepts[0] === c && !blocked.has(q.id));
    if (!cands.length) continue;
    const hard = cands.filter((q) => q.difficulty >= 2);
    const list = hard.length ? hard : cands;
    take(list[Math.floor(rand() * list.length)]);
  }
  while (picked.length < BOSS_MCQS) {
    const rest = pool.filter((q) => !blocked.has(q.id));
    if (!rest.length) break;
    take(rest[Math.floor(rand() * rest.length)]);
  }
  const matchings = bundle.matching.filter((m) => m.chapter === chapter);
  const fills = shuffle(bundle.fillBlanks.filter((f) => f.chapter === chapter), rand).slice(0, BOSS_FILLS);
  return {
    chapter,
    mcqIds: shuffle(picked.map((q) => q.id), rand),
    matchingId: matchings.length ? matchings[Math.floor(rand() * matchings.length)].id : null,
    fillIds: fills.map((f) => f.id),
  };
}

export function bossLength(p: BossPaper) {
  return p.mcqIds.length + (p.matchingId ? 1 : 0) + p.fillIds.length;
}

/** Won = score ≥ 80% and at least one heart left. */
export function bossOutcome(right: number, total: number, wrong: number) {
  const hearts = Math.max(0, BOSS_HEARTS - wrong);
  return { hearts, won: hearts > 0 && total > 0 && right / total >= BOSS_PASS, pct: total ? right / total : 0 };
}

/* ---------------- Fill-in-the-blank & matching checks ---------------- */

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');

export function checkFill(f: FillBlank, input: string): boolean {
  const got = normalize(input);
  if (!got) return false;
  return [f.answer, ...f.accept].some((a) => {
    const want = normalize(a);
    return got === want || (want.length > 5 && got.replace(/s$/, '') === want.replace(/s$/, ''));
  });
}

/** Returns which left-hand items were matched correctly (picks[i] = chosen right-hand text). */
export function checkMatching(m: Matching, picks: (string | undefined)[]): boolean[] {
  return m.pairs.map(([, right], i) => picks[i] === right);
}

/* ---------------- Lightning round ---------------- */

export const LIGHTNING_SECONDS = 60;
export const LIGHTNING_PENALTY_S = 3;

/** Quick questions for a lightning round: recall + practice on concepts you've seen (or everything if none seen). */
export function lightningPool(bundle: ContentBundle, seen: Set<string>, chapters: ChapterId[]): Mcq[] {
  const base = bundle.mcqs.filter((q) => !q.outOfScope && chapters.includes(q.chapter) && (q.kind === 'recall' || q.kind === 'practice') && q.q.length < 220);
  const onSeen = base.filter((q) => seen.has(q.concepts[0]));
  return onSeen.length >= 20 ? onSeen : base;
}

/* ---------------- Flashcards (Leitner boxes) ---------------- */

export type CardRating = 'again' | 'good' | 'easy';
export interface CardState {
  box: number; // 0 = new/forgotten … 5
  due: number;
  reviews: number;
}
const BOX_DAYS = [0, 0.5, 1, 2, 4, 8];
const HOUR = 3_600_000;

export const cardId = (conceptId: string, termIdx: number) => `card:${conceptId}:${termIdx}`;

/**
 * Replays flashcard ratings (attempts with questionId "card:…", rating in meta)
 * into Leitner boxes: again → box 0 (due in 10 min), good → +1, easy → +2.
 */
export function cardStates(attempts: Attempt[]): Map<string, CardState> {
  const out = new Map<string, CardState>();
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    if (!a.questionId.startsWith('card:')) continue;
    const s = out.get(a.questionId) ?? { box: 0, due: 0, reviews: 0 };
    const r = a.meta?.rating as CardRating | undefined;
    s.box = r === 'again' ? 0 : Math.min(5, s.box + (r === 'easy' ? 2 : 1));
    s.due = a.ts + (s.box === 0 ? HOUR / 6 : BOX_DAYS[s.box] * 24 * HOUR);
    s.reviews++;
    out.set(a.questionId, s);
  }
  return out;
}

/** Due cards first (most overdue first), then new cards in path order. */
export function cardQueue(allIds: string[], states: Map<string, CardState>, now: number): string[] {
  const due = allIds.filter((id) => states.has(id) && states.get(id)!.due <= now).sort((a, b) => states.get(a)!.due - states.get(b)!.due);
  const fresh = allIds.filter((id) => !states.has(id));
  return [...due, ...fresh];
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
