import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mcq } from '../content/types';
import type { Confidence } from '../lib/types';
import { canShuffle, conceptById, CHAPTER_SHORT } from '../lib/content';
import { ConceptPanel, Source } from './ConceptPanel';
import { ChapterChip, tabStyle } from './ui';

export interface McqResult {
  correct: boolean;
  confidence: Confidence | null;
  chosen: number; // original option index
  ms: number;
}

const LETTERS = 'ABCDEF';
/** Explanations often open with "Correct —"; the card already says that. */
const clean = (e: string) => e.replace(/^(correct|incorrect|wrong|no)\s*[—–:.,-]\s*/i, '').replace(/^./, (c) => c.toUpperCase());
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
  nextLabel = 'Next question',
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
    <div className="sheet space-y-5" style={tabStyle(q.chapter)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ChapterChip ch={q.chapter} title={CHAPTER_SHORT[q.chapter]} />
        {q.official && <span className="text-xs font-semibold text-ink">{q.pastMidterm ? 'Past midterm question' : 'Official practice question'}</span>}
        {q.type === 'application' && <span className="text-xs text-pencil">Application</span>}
        {header}
      </div>
      <p className="max-w-[68ch] font-serif text-[19px] leading-relaxed sm:text-[21px]">{q.q}</p>
      <ol className="grid gap-2">
        {order.map((orig, i) => {
          const chosen = sel === i;
          const right = done && i === correctDisplay;
          const wrong = done && chosen && !right;
          let cls = 'border-rule hover:border-pencil/60';
          if (!done && chosen) cls = 'border-ink bg-brand-50';
          else if (done && !right && !wrong) cls = 'border-rule opacity-55';
          else if (done) cls = 'border-rule';
          return (
            <li key={orig}>
              <button
                disabled={done}
                onClick={() => setSel(i)}
                aria-pressed={chosen}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-[15px] transition-colors sm:text-base ${cls}`}
              >
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold ${!done && chosen ? 'border-ink bg-ink text-sheet' : 'border-rule text-pencil'}`}>{i + 1}</span>
                <span className="flex-1">
                  <span className={right ? 'hl animate-swipe' : wrong ? 'strike animate-strike' : ''}>{q.options[orig]}</span>
                </span>
                {right && <span className="font-bold text-tick" aria-label="Correct answer">✓</span>}
                {wrong && <span className="font-bold text-redpen" aria-label="Your answer, wrong">✗</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {!done && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {askConfidence ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-pencil">How sure?</span>
              <div className="flex overflow-hidden rounded-[10px] border border-rule" role="radiogroup" aria-label="Confidence">
                {CONF.map((c) => (
                  <button
                    key={c.key}
                    role="radio"
                    aria-checked={conf === c.key}
                    onClick={() => setConf(c.key)}
                    className={`px-3 py-1.5 text-[13px] font-semibold ${conf === c.key ? 'bg-ink text-sheet' : 'text-ink/80 hover:bg-brand-50'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : <span />}
          <button className="btn-primary" disabled={sel === null} onClick={submit}>Check answer</button>
        </div>
      )}

      {done && (
        <div className="space-y-4">
          {isCorrect ? (
            <div className="border-l-2 border-tick pl-3 text-[15px]">
              <p><b className="text-tick">Correct.</b> {clean(q.explanations[q.answer])}</p>
              <p className="mt-1"><Source src={q.src} /></p>
            </div>
          ) : (
            <div className="space-y-2 border-l-2 border-redpen pl-3 text-[15px]">
              <p className="font-semibold text-redpen">Not quite. Here's why each option is right or wrong:</p>
              <ol className="space-y-1.5">
                {order.map((orig, i) => (
                  <li key={orig} className={orig === q.answer ? 'text-ink' : i === sel ? 'text-ink' : 'text-pencil'}>
                    <span className="mr-1 font-bold">{i + 1}.</span>
                    {orig === q.answer ? <span className="hl font-semibold">Answer:</span> : i === sel ? <span className="font-semibold text-redpen">Your pick:</span> : null} {clean(q.explanations[orig])}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Source src={q.src} />
                {concept && (
                  <button className="text-[13px] font-semibold text-ink underline decoration-hl decoration-[3px] underline-offset-4" onClick={() => setExplore((v) => !v)}>
                    {explore ? 'Hide the concept' : 'Explore the concept (E)'}
                  </button>
                )}
              </div>
              {explore && concept && (
                <div className="mt-2 rounded-md bg-paper p-4">
                  <ConceptPanel concept={concept} />
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button ref={nextBtn} className="btn-primary min-w-36" onClick={onNext}>{nextLabel}</button>
          </div>
        </div>
      )}
      <p className="hidden text-xs text-pencil sm:block">Keys: <kbd>1</kbd>–<kbd>{q.options.length}</kbd> choose, <kbd>S</kbd> <kbd>U</kbd> <kbd>G</kbd> confidence, <kbd>Enter</kbd> check or next, <kbd>E</kbd> explore</p>
    </div>
  );
}

export { LETTERS };
