/**
 * Compiles the hand-authored YAML in content/src/ into src/data/content.json
 * and validates it. Run: `npm run content` (also runs before `npm run build`).
 * Exits non-zero if validation fails.
 *
 * Authoring format (per chapter file, e.g. content/src/ch4a.yaml):
 *   chapter: 4
 *   title: Consumer Behaviour        # needed in one file per chapter
 *   concepts:
 *     - id, title, src, explain, alt, terms: {Term: def}, example
 *       recall:   [mcq]   -> ids <concept>-r1..
 *       practice: [mcq]   -> ids <concept>-p1..
 *       examples: [mcq]   -> ids <concept>-x1..  ("which example fits")
 *   short_answers: [{q, t, c, model, rubric: [{p, k}], mistakes, src}]
 *   matching: [{prompt, c, pairs, src}]
 *   fill: [{text, a, accept, c, src}]
 * mcq: {q, o: [..], a: A-E, e: [..], t: th|app, d: 1-3, c: [extra concept ids], src}
 *
 * IDs are derived from position, so append new questions rather than reordering
 * (attempt history references question ids).
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type {
  ChapterId, Chapter, Concept, ContentBundle, Mcq, McqKind, ShortAnswer, Matching, FillBlank, Confusable,
} from '../src/content/types';
import { CHAPTERS } from '../src/content/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'content/src');
const OUT = path.join(ROOT, 'src/data/content.json');

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

const letter = (a: any, n: number, where: string): number => {
  const idx = typeof a === 'number' ? a : 'ABCDEFGH'.indexOf(String(a).trim().toUpperCase());
  if (idx < 0 || idx >= n) err(`${where}: answer "${a}" out of range`);
  return idx;
};

function mcq(raw: any, id: string, kind: McqKind, chapter: ChapterId, primary: string[], defSrc: string): Mcq {
  const options: string[] = raw.o ?? [];
  const concepts = [...new Set([...primary, ...(raw.c ?? [])])];
  return {
    id, kind, chapter, concepts,
    type: raw.t === 'app' ? 'application' : 'theory',
    difficulty: raw.d ?? (kind === 'recall' ? 1 : 2),
    q: String(raw.q ?? '').trim(),
    options: options.map((o) => String(o)),
    answer: letter(raw.a, options.length, id),
    explanations: (raw.e ?? []).map((x: any) => String(x)),
    src: raw.src ?? defSrc,
    siblings: [],
    ...(raw.official ? { official: true } : {}),
    ...(raw.pastMidterm ? { pastMidterm: true } : {}),
    ...(raw.outOfScope ? { outOfScope: true } : {}),
  };
}

const chapters = new Map<ChapterId, Chapter>();
const concepts: Concept[] = [];
const mcqs: Mcq[] = [];
const shortAnswers: ShortAnswer[] = [];
const matching: Matching[] = [];
const fillBlanks: FillBlank[] = [];
const confusables: Confusable[] = [];

const files = fs.readdirSync(SRC).filter((f) => /^ch\d+[a-z]?\.ya?ml$/.test(f)).sort();
for (const f of files) {
  const doc: any = yaml.load(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const ch = doc.chapter as ChapterId;
  if (!CHAPTERS.includes(ch)) { err(`${f}: chapter ${ch} is not a midterm chapter`); continue; }
  const chapter = chapters.get(ch) ?? { id: ch, title: '', conceptIds: [] };
  if (doc.title) chapter.title = doc.title;
  chapters.set(ch, chapter);

  for (const c of doc.concepts ?? []) {
    if (!String(c.id).startsWith(`ch${ch}-`)) err(`${f}: concept ${c.id} id must start with ch${ch}-`);
    chapter.conceptIds.push(c.id);
    concepts.push({
      id: c.id, chapter: ch, title: c.title, explain: String(c.explain ?? '').trim(), alt: String(c.alt ?? '').trim(),
      terms: Object.entries(c.terms ?? {}).map(([term, def]) => ({ term, def: String(def) })),
      example: String(c.example ?? '').trim(), src: c.src,
    });
    (c.recall ?? []).forEach((q: any, i: number) => mcqs.push(mcq(q, `${c.id}-r${i + 1}`, 'recall', ch, [c.id], c.src)));
    (c.practice ?? []).forEach((q: any, i: number) => mcqs.push(mcq(q, `${c.id}-p${i + 1}`, 'practice', ch, [c.id], c.src)));
    (c.examples ?? []).forEach((q: any, i: number) => mcqs.push(mcq(q, `${c.id}-x${i + 1}`, 'example', ch, [c.id], c.src)));
  }
  const n = (arr: unknown[]) => arr.length + 1;
  for (const s of doc.short_answers ?? []) {
    shortAnswers.push({
      id: `ch${ch}-sa${n(shortAnswers.filter((x) => x.chapter === ch))}`, chapter: ch, concepts: s.c ?? [],
      type: s.t === 'app' ? 'application' : 'theory', q: String(s.q).trim(), model: String(s.model).trim(),
      rubric: (s.rubric ?? []).map((r: any) => ({ point: r.p, keywords: r.k ?? [] })),
      mistakes: s.mistakes ?? [], src: s.src,
    });
  }
  for (const m of doc.matching ?? []) {
    matching.push({ id: `ch${ch}-m${n(matching.filter((x) => x.chapter === ch))}`, chapter: ch, concepts: m.c ?? [], prompt: m.prompt, pairs: m.pairs, src: m.src });
  }
  for (const b of doc.fill ?? []) {
    fillBlanks.push({ id: `ch${ch}-f${n(fillBlanks.filter((x) => x.chapter === ch))}`, chapter: ch, concepts: b.c ?? [], text: b.text, answer: String(b.a), accept: (b.accept ?? []).map(String), src: b.src });
  }
}

// Official questions (verbatim) — content/src/official.yaml
const officialPath = path.join(SRC, 'official.yaml');
if (fs.existsSync(officialPath)) {
  const list: any[] = (yaml.load(fs.readFileSync(officialPath, 'utf8')) as any[]) ?? [];
  for (const o of list) {
    const q = mcq({ ...o, official: true }, o.id, 'official', o.ch, [], o.src);
    if (o.twin) q.twin = o.twin;
    mcqs.push(q);
  }
}

// Confusable pairs — content/src/confusables.yaml
const confPath = path.join(SRC, 'confusables.yaml');
if (fs.existsSync(confPath)) {
  const list: any[] = (yaml.load(fs.readFileSync(confPath, 'utf8')) as any[]) ?? [];
  for (const cf of list) {
    const ids: string[] = [];
    (cf.questions ?? []).forEach((q: any, i: number) => {
      const id = `${cf.id}-q${i + 1}`;
      ids.push(id);
      const ch = Number(String(q.c?.[0] ?? cf.c[0]).match(/^ch(\d+)/)?.[1]) as ChapterId;
      mcqs.push(mcq(q, id, 'confusable', ch, cf.c, cf.src ?? q.src));
    });
    confusables.push({
      id: cf.id, title: cf.title, concepts: cf.c, columns: cf.cols,
      rows: (cf.rows ?? []).map((r: string[]) => ({ aspect: r[0], cells: r.slice(1) })), tip: cf.tip ?? '', questionIds: ids,
    });
  }
}

// Twins are symmetric.
for (const q of mcqs) {
  if (!q.twin) continue;
  const t = mcqs.find((o) => o.id === q.twin);
  if (!t) err(`${q.id}: twin ${q.twin} not found`);
  else t.twin = q.id;
}

// Siblings: other practice/example questions on the same primary concept.
for (const q of mcqs) {
  if (q.kind !== 'practice' && q.kind !== 'example') continue;
  const pool = mcqs.filter((o) => o !== q && (o.kind === 'practice' || o.kind === 'example') && o.concepts[0] === q.concepts[0]);
  const i = pool.findIndex((o) => o.id > q.id);
  q.siblings = [pool[i >= 0 ? i : 0], pool[(i >= 0 ? i : 0) + 1]].filter(Boolean).map((o) => o!.id);
}

/* ---------------- explanation enrichment ----------------
 * Hand-written option explanations are often terse ("No.", "Correct.", "Listed.").
 * Expand them using definitions that already exist in the slide-grounded concept
 * data, so every option says WHY it is right or wrong. Nothing new is invented:
 * text comes from concept key terms / explanations and the options themselves.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
interface TermRef { name: string; key: string; def: string; conceptId: string }
const termIndex: TermRef[] = [];
for (const c of concepts) {
  for (const t of c.terms) termIndex.push({ name: t.term, key: norm(t.term.replace(/\(.*?\)/g, '')), def: t.def, conceptId: c.id });
}
const findTerm = (text: string): TermRef | undefined => {
  const o = norm(text.replace(/^[^a-z0-9]+/i, ''));
  if (o.length < 4) return undefined;
  let best: TermRef | undefined;
  for (const t of termIndex) {
    if (t.key.length < 4) continue;
    const hit = o === t.key || (t.key.length >= 5 && ` ${o} `.includes(` ${t.key} `)) || (o.length >= 5 && ` ${t.key} `.includes(` ${o} `));
    if (hit && (!best || t.key.length > best.key.length)) best = t;
  }
  return best;
};
const isTerse = (e: string) => e.replace(/[^a-z]/gi, '').length < 14 || /^(no|correct|unrelated|not stated|not the issue|the opposite|too narrow)\.?$/i.test(e.trim());
const LISTED = /^(listed|reason|valid|part|criterion|component|source|step|role|benefit|v|assessed|recommended|true|correct statement|macro|micro|qualitative|quantitative)\.?/i;
let enriched = 0;
for (const q of mcqs) {
  const negative = /\b(not|except|least)\b/i.test(q.q);
  const primary = conceptById(q.concepts[0]);
  const correctText = q.options[q.answer];
  const correctTerm = findTerm(correctText);
  const why = correctTerm ? `${correctTerm.name}: ${correctTerm.def}` : primary ? firstSentence(primary.explain) : '';
  q.explanations = q.explanations.map((e, i) => {
    if (!isTerse(e)) return e;
    enriched++;
    const opt = q.options[i];
    const base = e.trim().replace(/\.$/, '');
    if (i === q.answer) {
      if (negative) return `Correct — "${opt}" is the one that doesn't belong.${why ? ` ${why}` : ''}`;
      return `Correct — ${why || `"${opt}" matches what's described.`}`;
    }
    const label = /^(no|unrelated|not stated|not the issue)$/i.test(base) ? '' : ` (${base})`;
    if (negative && LISTED.test(e.trim())) return `"${opt}" is genuinely part of this concept in the slides, so it isn't the exception.`;
    if (negative && /^(no|the opposite|unrelated)$/i.test(base)) return `Not this — "${opt}" is not the exception the question asks for. The answer is "${correctText}".`;
    if (negative) return `"${opt}" does belong here${label}, so it isn't the exception.`;
    const t = findTerm(opt);
    if (t && t.key !== correctTerm?.key) return `Not this${label} — "${opt}" refers to ${t.name.toLowerCase()}: ${t.def}`;
    return `Not this${label} — "${opt}" doesn't match what the question describes. The answer is "${correctText}".`;
  });
}
function conceptById(id: string | undefined) {
  return concepts.find((c) => c.id === id);
}

/* ---------------- validation ---------------- */
const conceptIds = new Set(concepts.map((c) => c.id));
const seen = new Set<string>();
for (const id of [...concepts.map((c) => c.id), ...mcqs.map((q) => q.id), ...shortAnswers.map((s) => s.id)]) {
  if (seen.has(id)) err(`duplicate id ${id}`);
  seen.add(id);
}
for (const c of concepts) {
  for (const k of ['title', 'explain', 'alt', 'example', 'src'] as const) if (!c[k]) err(`${c.id}: missing ${k}`);
  if (c.terms.length === 0) err(`${c.id}: no key terms`);
  if (!/^Ch\. \d/.test(c.src ?? '')) err(`${c.id}: bad src "${c.src}"`);
  if (!/illustrative/i.test(c.example)) err(`${c.id}: brand example must be labelled illustrative`);
  const qs = mcqs.filter((q) => q.concepts[0] === c.id);
  const r = qs.filter((q) => q.kind === 'recall').length;
  const p = qs.filter((q) => q.kind === 'practice').length;
  if (r < 2 || r > 3) err(`${c.id}: needs 2–3 recall MCQs (has ${r})`);
  if (p < 5) err(`${c.id}: needs ≥5 practice MCQs (has ${p})`);
}
for (const q of mcqs) {
  if (!q.q) err(`${q.id}: empty stem`);
  if (q.kind === 'practice' || q.kind === 'recall' || q.kind === 'example') {
    if (q.options.length !== 4) err(`${q.id}: must have 4 options (has ${q.options.length})`);
  }
  if (q.explanations.length !== q.options.length) err(`${q.id}: ${q.explanations.length} explanations for ${q.options.length} options`);
  if (q.kind !== 'official' && new Set(q.options).size !== q.options.length) err(`${q.id}: duplicate options`);
  if (!q.src) err(`${q.id}: missing src`);
  if (!q.outOfScope && !CHAPTERS.includes(q.chapter)) err(`${q.id}: chapter ${q.chapter} not on midterm`);
  if (q.concepts.length === 0 && !q.outOfScope) err(`${q.id}: not mapped to any concept`);
  for (const c of q.concepts) if (!conceptIds.has(c)) err(`${q.id}: unknown concept ${c}`);
}
for (const s of shortAnswers) {
  if (s.rubric.length < 3) err(`${s.id}: rubric needs ≥3 points`);
  for (const r of s.rubric) if (r.keywords.length === 0) err(`${s.id}: rubric point "${r.point}" has no keywords`);
  if (s.model.split(/\n\s*\n/).length < 2) warnings.push(`${s.id}: model answer is a single paragraph`);
  if (!s.src) err(`${s.id}: missing src`);
  for (const c of s.concepts) if (!conceptIds.has(c)) err(`${s.id}: unknown concept ${c}`);
}
for (const x of [...matching, ...fillBlanks]) {
  if (!x.src) err(`${x.id}: missing src`);
  for (const c of x.concepts) if (!conceptIds.has(c)) err(`${x.id}: unknown concept ${c}`);
}
for (const b of fillBlanks) if (!b.text.includes('___')) err(`${b.id}: no blank`);
for (const cf of confusables) for (const c of cf.concepts) if (!conceptIds.has(c)) err(`${cf.id}: unknown concept ${c}`);
for (const ch of CHAPTERS) {
  const chap = chapters.get(ch);
  if (!chap) { err(`chapter ${ch} has no content`); continue; }
  if (!chap.title) err(`chapter ${ch} missing title`);
  const sa = shortAnswers.filter((s) => s.chapter === ch);
  if (sa.length < 4) err(`chapter ${ch}: needs ≥4 short-answer questions (has ${sa.length})`);
  if (!sa.some((s) => s.type === 'theory') || !sa.some((s) => s.type === 'application')) err(`chapter ${ch}: short answers must mix theory & application`);
}
const practiceTotal = mcqs.filter((q) => q.kind === 'practice').length;
if (practiceTotal < 300) err(`practice bank has ${practiceTotal} MCQs (need ≥300)`);
if (concepts.some((c) => (c.chapter as number) === 5)) err('Chapter 5 content found');

const bundle: ContentBundle = {
  version: new Date().toISOString().slice(0, 10) + '-' + mcqs.length,
  chapters: CHAPTERS.filter((c) => chapters.has(c)).map((c) => chapters.get(c)!),
  concepts, mcqs, shortAnswers, matching, fillBlanks, confusables,
};

const count = (k: McqKind) => mcqs.filter((q) => q.kind === k).length;
console.log(`enriched ${enriched} terse explanations`);
console.log(
  `concepts ${concepts.length} | recall ${count('recall')} | practice ${practiceTotal} | example ${count('example')} | ` +
  `official ${count('official')} | confusable ${count('confusable')} | short ${shortAnswers.length} | matching ${matching.length} | fill ${fillBlanks.length}`,
);
for (const w of warnings) console.warn('warn:', w);
const partial = process.argv.includes('--partial');
if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors.slice(0, 60)) console.error(' -', e);
  if (!partial) process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
