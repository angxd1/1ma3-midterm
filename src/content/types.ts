// Shape of the static content bundle produced by scripts/build-content.ts.

export type ChapterId = 3 | 4 | 6 | 7 | 8 | 9;
export const CHAPTERS: ChapterId[] = [3, 4, 6, 7, 8, 9];

export interface Chapter {
  id: ChapterId;
  title: string;
  conceptIds: string[]; // in learning-path order
}

export interface Concept {
  id: string;
  chapter: ChapterId;
  title: string;
  explain: string;
  alt: string; // "explained differently" (analogy)
  terms: { term: string; def: string }[];
  example: string; // illustrative brand example
  src: string;
}

export type QType = 'theory' | 'application';
export type McqKind = 'recall' | 'practice' | 'example' | 'official' | 'confusable';

export interface Mcq {
  id: string;
  kind: McqKind;
  chapter: ChapterId;
  concepts: string[];
  type: QType;
  difficulty: 1 | 2 | 3;
  q: string;
  options: string[];
  answer: number;
  explanations: string[]; // one per option
  src: string;
  siblings: string[];
  official?: boolean;
  pastMidterm?: boolean;
  outOfScope?: boolean;
}

export interface RubricPoint {
  point: string;
  keywords: string[]; // each entry may hold "a|b|c" synonyms
}

export interface ShortAnswer {
  id: string;
  chapter: ChapterId;
  concepts: string[];
  type: QType;
  q: string;
  model: string;
  rubric: RubricPoint[];
  mistakes: string[];
  src: string;
}

export interface Matching {
  id: string;
  chapter: ChapterId;
  concepts: string[];
  prompt: string;
  pairs: [string, string][];
  src: string;
}

export interface FillBlank {
  id: string;
  chapter: ChapterId;
  concepts: string[];
  text: string; // contains "___"
  answer: string;
  accept: string[];
  src: string;
}

export interface Confusable {
  id: string;
  title: string;
  concepts: string[];
  columns: string[]; // concept names, one per column
  rows: { aspect: string; cells: string[] }[];
  tip: string;
  questionIds: string[];
}

export interface ContentBundle {
  version: string;
  chapters: Chapter[];
  concepts: Concept[];
  mcqs: Mcq[];
  shortAnswers: ShortAnswer[];
  matching: Matching[];
  fillBlanks: FillBlank[];
  confusables: Confusable[];
}
