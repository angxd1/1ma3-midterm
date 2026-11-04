import type { RubricPoint } from '../content/types';

/** Very small suffix stemmer — enough to match "segments"/"segmentation"/"segmenting". */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  for (const suf of ['ational', 'ation', 'ations', 'ising', 'izing', 'ments', 'ment', 'ings', 'ing', 'ness', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 's', 'al', 'ly']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w;
}

const normalise = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();

/** Does the answer contain this synonym phrase? Multi-word phrases must appear as a stemmed sequence; prefixes match. */
export function containsPhrase(answer: string, phrase: string): boolean {
  const ans = normalise(answer);
  const p = normalise(phrase);
  if (!p) return false;
  if (ans.includes(p)) return true;
  const aw = ans.split(' ').map(stem);
  const pw = p.split(' ').map(stem);
  for (let i = 0; i + pw.length <= aw.length; i++) {
    if (pw.every((w, j) => aw[i + j].startsWith(w) || w.startsWith(aw[i + j]) && aw[i + j].length >= 4)) return true;
  }
  return false;
}

export interface RubricCheck {
  point: string;
  hits: string[]; // matched synonyms
  missing: string[]; // keyword groups with no match
  detected: boolean;
}

/**
 * Each rubric point has keyword groups; a group is "a|b|c" (any synonym matches).
 * A point is detected when every group matches.
 */
export function checkRubric(answer: string, rubric: RubricPoint[]): RubricCheck[] {
  return rubric.map((r) => {
    const hits: string[] = [];
    const missing: string[] = [];
    for (const group of r.keywords) {
      const syns = group.split('|').map((s) => s.trim()).filter(Boolean);
      const found = syns.find((s) => containsPhrase(answer, s));
      if (found) hits.push(found);
      else missing.push(syns[0]);
    }
    return { point: r.point, hits, missing, detected: missing.length === 0 };
  });
}
