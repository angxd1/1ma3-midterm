export type Confidence = 'sure' | 'unsure' | 'guess';
export type Mode = 'lesson' | 'path' | 'mastery' | 'mock' | 'boss' | 'lightning' | 'review' | 'flashcard' | 'confusable';

/**
 * One row of the append-only log. Everything (coverage, mastery, schedule,
 * mistakes, XP) is derived from these, so merging devices is a set union by id.
 */
export interface Attempt {
  id: string; // uuid
  questionId: string; // MCQ / short-answer id, or "lesson:<conceptId>" for a completed lesson
  conceptIds: string[];
  correct: boolean;
  confidence: Confidence | null;
  mode: Mode;
  ts: number; // epoch ms
  meta?: Record<string, unknown>; // e.g. { ms: time spent, mockId, score }
}

export interface Settings {
  examDate: string; // YYYY-MM-DD
  masteryN: number; // 3..5
  theme: 'system' | 'light' | 'dark';
  dailyGoal: number; // XP per day
}

export const DEFAULT_SETTINGS: Settings = { examDate: '2026-11-09', masteryN: 3, theme: 'system', dailyGoal: 150 };
