import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mcq } from '../content/types';
import type { Confidence } from '../lib/types';
import { canShuffle, conceptById, CHAPTER_SHORT } from '../lib/content';
import { ConceptPanel, Source } from './ConceptPanel';

export interface McqResult {
  correct: boolean;
  confidence: Confidence | null;
  chosen: number; // original option index
  ms: number;
}

const LETTERS = 'ABCDEF';
const CONF: { key: Confidence; label: string }[] = [
  { key: 'sure', label: 'Sure' },
  { key: 'unsure', label: 'Unsure' },
  { key: 'guess', label: 'Guessing' },
];

function useOrder(q: Mcq, shuffleOn: boolean) {
  return useMemo(() => {
    const idx = q.options.map((_, i) => i);
    if (!shuffleOn || !canShuffle(q)) return idx;
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, shuffleOn]);
}

/**
 * A multiple-choice question with instant feedback.
 * Keys: 1–n select, Enter submit/next, E explore concept, S/U/G confidence.
 */
export function McqCard({
  q,
  onAnswered,
  onNext,
  askConfidence = true,
  nextLabel = 'Next',
  header,
}: {
  q: Mcq;
  onAnswered: (r: McqResult) => void;
  onNext: () => void;
  askConfidence?: boolean;
  nextLabel?: string;
  header?: React.ReactNode;
}) {
  const order = useOrder(q, true);
  const [sel, setSel] = useState<number | null>(null); // display index
  const [conf, setConf] = useState<Confidence | null>(null);
  const [done, setDone] = useState(false);
  const [explore, setExplore] = useState(false);
  const started = useRef(Date.now());
  const nextBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSel(null);
    setConf(null);
    setDone(false);
    setExplore(false);
    started.current = Date.now();
  }, [q.id]);

  const correctDisplay = order.indexOf(q.answer);
  const isCorrect = done && sel === correctDisplay;
  const concept = conceptById.get(q.concepts[0]);

  const submit = () => {
    if (sel === null || done) return;
    const confidence = askConfidence ? conf ?? 'sure' : null;
    setDone(true);
    onAnswered({ correct: sel === correctDisplay, confidence, chosen: order[sel], ms: Date.now() - started.current });
    setTimeout(() => nextBtn.current?.focus(), 0);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!done && n >= 1 && n <= q.options.length) setSel(n - 1);
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (done) onNext();
        else submit();
      } else if ((e.key === 'e' || e.key === 'E') && done) setExplore((v) => !v);
      else if (!done && askConfidence && ['s', 'u', 'g'].includes(e.key.toLowerCase())) {
        setConf(({ s: 'sure', u: 'unsure', g: 'guess' } as const)[e.key.toLowerCase() as 's' | 'u' | 'g']);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="card animate-pop space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {header}
        <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ch {q.chapter} · {CHAPTER_SHORT[q.chapter]}</span>
        {q.official && <span className="chip bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{q.pastMidterm ? 'Past midterm' : 'Official practice'}</span>}
        {q.type === 'application' && <span className="chip bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">Application</span>}
      </div>
      <p className="text-base font-medium leading-relaxed sm:text-lg">{q.q}</p>
      <div className="grid gap-2">
        {order.map((orig, i) => {
          const chosen = sel === i;
          let cls = 'border-slate-200 hover:border-brand-400 dark:border-slate-700';
          if (!done && chosen) cls = 'border-brand-500 bg-brand-50 dark:bg-brand-700/20';
          if (done && i === correctDisplay) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30';
          else if (done && chosen) cls = 'border-rose-500 bg-rose-50 animate-shake dark:bg-rose-900/30';
          else if (done) cls = 'border-slate-200 opacity-70 dark:border-slate-800';
          return (
            <button
              key={orig}
              disabled={done}
              onClick={() => setSel(i)}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left text-sm transition sm:text-base ${cls}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold dark:bg-slate-800">{i + 1}</span>
              <span>{q.options[orig]}</span>
            </button>
          );
        })}
      </div>

      {!done && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {askConfidence ? (
            <div className="flex gap-1" role="radiogroup" aria-label="Confidence">
              {CONF.map((c) => (
                <button
                  key={c.key}
                  role="radio"
                  aria-checked={conf === c.key}
                  onClick={() => setConf(c.key)}
                  className={`chip border px-3 py-1 ${conf === c.key ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : <span />}
          <button className="btn-primary" disabled={sel === null} onClick={submit}>Check</button>
        </div>
      )}

      {done && (
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          {isCorrect ? (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
              <b>Correct!</b> {q.explanations[q.answer]}
              <div className="mt-2"><Source src={q.src} /></div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
              <p className="font-semibold text-rose-800 dark:text-rose-200">Not quite — here's why each option is right or wrong:</p>
              <ul className="space-y-1.5">
                {order.map((orig, i) => (
                  <li key={orig} className={orig === q.answer ? 'font-medium text-emerald-800 dark:text-emerald-200' : i === sel ? 'text-rose-800 dark:text-rose-200' : 'text-slate-600 dark:text-slate-300'}>
                    <span className="font-bold">{i + 1}.</span> {orig === q.answer ? '✓ ' : i === sel ? '✗ Your answer: ' : ''}{q.explanations[orig]}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Source src={q.src} />
                {concept && (
                  <button className="chip bg-brand-600 px-3 py-1 text-white hover:bg-brand-700" onClick={() => setExplore((v) => !v)}>
                    {explore ? 'Hide concept' : 'Explore concept (E)'}
                  </button>
                )}
              </div>
              {explore && concept && (
                <div className="mt-2 rounded-xl bg-white p-3 dark:bg-slate-900">
                  <ConceptPanel concept={concept} />
                </div>
              )}
            </div>
          )}
          <button ref={nextBtn} className="btn-primary md:min-w-28" onClick={onNext}>{nextLabel} ↵</button>
        </div>
      )}
      <p className="hidden text-[11px] text-slate-400 sm:block">Keys: 1–{q.options.length} choose · S/U/G confidence · Enter check/next · E explore</p>
    </div>
  );
}

export { LETTERS };
