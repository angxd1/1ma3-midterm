import type { Attempt } from './types';
import { isLesson, masteredConcepts, pendingMistakes, everWrong, seenConcepts } from './stats';

/**
 * XP, levels, daily streaks and badges — all derived from the attempt log, so
 * they sync across devices for free and can never drift from real progress.
 */

export const isMockMarker = (a: Attempt) => a.questionId.startsWith('mock:');
export const isBossMarker = (a: Attempt) => a.questionId.startsWith('boss:');
export const isLightningMarker = (a: Attempt) => a.questionId.startsWith('lightning:');
export const isCard = (a: Attempt) => a.questionId.startsWith('card:');
/** A real answered question — not a lesson, flashcard, or a mock/boss/lightning result marker. */
export const isQuestion = (a: Attempt) => !isLesson(a) && !/^(mock|boss|lightning|card):/.test(a.questionId);

const isShortAnswer = (a: Attempt) => typeof a.meta?.outOf === 'number';

/** XP for one attempt. Combo multipliers from Version A are stored in meta.mult. */
export function xpFor(a: Attempt): number {
  if (isLesson(a)) return 20;
  if (isMockMarker(a)) return 100;
  if (isBossMarker(a)) return a.meta?.won ? 150 : 25;
  if (isLightningMarker(a)) return 0; // each answer already earned XP
  if (isCard(a)) return 2;
  if (isShortAnswer(a)) {
    const score = Number(a.meta?.score ?? 0);
    const outOf = Number(a.meta?.outOf ?? 1) || 1;
    return 5 + Math.round(25 * (score / outOf));
  }
  if (!a.correct) return 1; // showing up still counts a little
  const base = a.confidence === 'guess' ? 5 : 10;
  const mult = typeof a.meta?.mult === 'number' ? a.meta.mult : 1;
  return Math.round(base * mult);
}

export const totalXp = (attempts: Attempt[]) => attempts.reduce((s, a) => s + xpFor(a), 0);

/** Cumulative XP needed to reach a level: 0, 100, 300, 600, 1000, … */
export const levelThreshold = (level: number) => 50 * (level - 1) * level;

export const LEVEL_TITLES = ['Freshman', 'Note-taker', 'Highlighter', 'Flashcard Fiend', 'Segmenter', 'Positioner', 'Brand Builder', 'Researcher', 'Product Launcher', 'Marketing Maven', 'CMO in Training'];

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= levelThreshold(level + 1)) level++;
  const from = levelThreshold(level);
  const to = levelThreshold(level + 1);
  return { level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)], xp, into: xp - from, span: to - from, progress: (xp - from) / (to - from) };
}

/** Local calendar day key, e.g. "2026-11-05". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
const prevDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
};

export function xpByDay(attempts: Attempt[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of attempts) m.set(dayKey(a.ts), (m.get(dayKey(a.ts)) ?? 0) + xpFor(a));
  return m;
}

/**
 * Daily streak: consecutive days with any study. The streak is still "alive"
 * if today has nothing yet but yesterday did (you have until midnight).
 */
export function streakInfo(attempts: Attempt[], now: number) {
  const days = new Set(attempts.map((a) => dayKey(a.ts)));
  const today = dayKey(now);
  let cursor = days.has(today) ? today : prevDay(today);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = prevDay(cursor);
  }
  let best = 0;
  for (const d of days) {
    if (days.has(prevDay(d))) continue; // only start counting at the first day of a run
    let len = 0;
    let c = d;
    while (days.has(c)) {
      len++;
      const [y, m, dd] = c.split('-').map(Number);
      c = dayKey(new Date(y, m - 1, dd + 1, 12).getTime());
    }
    best = Math.max(best, len);
  }
  return { current, best, studiedToday: days.has(today) };
}

/** Longest run of consecutive correct, non-guess answers in the log. */
export function bestCorrectRun(attempts: Attempt[]): number {
  let run = 0;
  let best = 0;
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    if (!isQuestion(a) || isShortAnswer(a)) continue;
    if (a.mode === 'mock' && a.meta?.skipped) continue;
    run = a.correct && a.confidence !== 'guess' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface BadgeCtx {
  attempts: Attempt[];
  chapters: { id: number; conceptIds: string[] }[];
  totalConcepts: number;
  masteryN: number;
  related: (qid: string) => string[];
  now: number;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  earned: (s: BadgeStats) => boolean;
}

interface BadgeStats {
  answered: number;
  correct: number;
  lessons: number;
  run: number;
  seen: Set<string>;
  mastered: Set<string>;
  chapters: { id: number; conceptIds: string[] }[];
  totalConcepts: number;
  fixed: number;
  mocks: { score: number; of: number }[];
  streakBest: number;
  saFull: boolean;
  sure: { right: number; total: number };
  bossWins: number;
  lightningBest: number;
}

export function badgeStats(c: BadgeCtx): BadgeStats {
  const qs = c.attempts.filter(isQuestion);
  const mcqs = qs.filter((a) => !isShortAnswer(a));
  const owed = new Set(pendingMistakes(c.attempts, c.related));
  const wrong = everWrong(c.attempts);
  const sure = mcqs.filter((a) => a.confidence === 'sure');
  return {
    answered: qs.length,
    correct: mcqs.filter((a) => a.correct).length,
    lessons: c.attempts.filter(isLesson).length,
    run: bestCorrectRun(c.attempts),
    seen: seenConcepts(c.attempts),
    mastered: masteredConcepts(c.attempts, c.masteryN),
    chapters: c.chapters,
    totalConcepts: c.totalConcepts,
    fixed: [...wrong].filter((id) => !owed.has(id) && !c.attempts.some((a) => a.questionId === id && isShortAnswer(a))).length,
    mocks: c.attempts.filter(isMockMarker).map((a) => ({ score: Number(a.meta?.score ?? 0), of: Number(a.meta?.of ?? 60) })),
    streakBest: streakInfo(c.attempts, c.now).best,
    saFull: qs.some((a) => isShortAnswer(a) && Number(a.meta?.score) >= Number(a.meta?.outOf) && Number(a.meta?.outOf) > 0),
    sure: { right: sure.filter((a) => a.correct).length, total: sure.length },
    bossWins: new Set(c.attempts.filter((a) => isBossMarker(a) && a.meta?.won).map((a) => a.questionId.split(':')[1])).size,
    lightningBest: Math.max(0, ...c.attempts.filter(isLightningMarker).map((a) => Number(a.meta?.score ?? 0))),
  };
}

const anyChapter = (s: BadgeStats, set: Set<string>) => s.chapters.some((ch) => ch.conceptIds.length && ch.conceptIds.every((id) => set.has(id)));

export const BADGES: Badge[] = [
  { id: 'first-lesson', icon: '🌱', name: 'First steps', desc: 'Finish your first lesson', earned: (s) => s.lessons >= 1 },
  { id: 'warm-up', icon: '✅', name: 'Warmed up', desc: 'Answer 10 questions correctly', earned: (s) => s.correct >= 10 },
  { id: 'century', icon: '💯', name: 'Century', desc: 'Answer 100 questions', earned: (s) => s.answered >= 100 },
  { id: 'grinder', icon: '🏋️', name: 'Grinder', desc: 'Answer 500 questions', earned: (s) => s.answered >= 500 },
  { id: 'on-fire', icon: '🔥', name: 'On fire', desc: '10 correct in a row (guesses break the run)', earned: (s) => s.run >= 10 },
  { id: 'unstoppable', icon: '☄️', name: 'Unstoppable', desc: '25 correct in a row', earned: (s) => s.run >= 25 },
  { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'See every concept in one chapter', earned: (s) => anyChapter(s, s.seen) },
  { id: 'cartographer', icon: '🗺️', name: 'Cartographer', desc: 'See all midterm concepts', earned: (s) => s.totalConcepts > 0 && s.seen.size >= s.totalConcepts },
  { id: 'champion', icon: '🏅', name: 'Chapter champion', desc: 'Master every concept in one chapter', earned: (s) => anyChapter(s, s.mastered) },
  { id: 'halfway', icon: '🎓', name: 'Halfway there', desc: 'Master half of all concepts', earned: (s) => s.totalConcepts > 0 && s.mastered.size >= s.totalConcepts / 2 },
  { id: 'slayer', icon: '🩹', name: 'Mistake slayer', desc: 'Fix 10 questions you got wrong', earned: (s) => s.fixed >= 10 },
  { id: 'rehearsal', icon: '⏱️', name: 'Dress rehearsal', desc: 'Finish a full mock midterm', earned: (s) => s.mocks.length >= 1 },
  { id: 'exam-ready', icon: '🎯', name: 'Exam ready', desc: 'Score 80%+ on a mock', earned: (s) => s.mocks.some((m) => m.of > 0 && m.score / m.of >= 0.8) },
  { id: 'streak-3', icon: '📅', name: 'Three-peat', desc: 'Study 3 days in a row', earned: (s) => s.streakBest >= 3 },
  { id: 'streak-5', icon: '🗓️', name: 'Five alive', desc: 'Study 5 days in a row', earned: (s) => s.streakBest >= 5 },
  { id: 'wordsmith', icon: '✍️', name: 'Wordsmith', desc: 'Full marks on a short answer', earned: (s) => s.saFull },
  { id: 'boss-slayer', icon: '👑', name: 'Boss slayer', desc: 'Beat a chapter boss', earned: (s) => s.bossWins >= 1 },
  { id: 'boss-sweep', icon: '🐉', name: 'Clean sweep', desc: 'Beat all six chapter bosses', earned: (s) => s.bossWins >= 6 },
  { id: 'lightning', icon: '⚡', name: 'Lightning reflexes', desc: 'Score 15+ in a lightning round', earned: (s) => s.lightningBest >= 15 },
  { id: 'calibrated', icon: '🧠', name: 'Self-aware', desc: '20+ answers marked “Sure”, 90%+ of them right', earned: (s) => s.sure.total >= 20 && s.sure.right / s.sure.total >= 0.9 },
];

export function earnedBadges(c: BadgeCtx): Set<string> {
  const s = badgeStats(c);
  return new Set(BADGES.filter((b) => b.earned(s)).map((b) => b.id));
}
