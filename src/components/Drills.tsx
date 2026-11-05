import { useMemo, useRef, useState } from 'react';
import type { FillBlank, Matching } from '../content/types';
import { checkFill, checkMatching, shuffle } from '../lib/drills';
import { Source } from './ConceptPanel';

/** Match each left-hand item to a right-hand option (dropdowns, so it works on phones). */
export function MatchingCard({ m, onDone, onNext }: { m: Matching; onDone: (right: number, total: number) => void; onNext: () => void }) {
  const options = useMemo(() => shuffle(m.pairs.map(([, r]) => r)), [m.id]);
  const [picks, setPicks] = useState<(string | undefined)[]>(() => m.pairs.map(() => undefined));
  const [done, setDone] = useState(false);
  const result = done ? checkMatching(m, picks) : null;
  const right = result?.filter(Boolean).length ?? 0;
  return (
    <div className="card animate-pop space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">Matching</span>
      </div>
      <p className="font-medium sm:text-lg">{m.prompt}</p>
      <div className="space-y-2">
        {m.pairs.map(([left, ans], i) => (
          <div key={left} className={`grid gap-2 rounded-xl border-2 p-2 sm:grid-cols-[1fr_1.4fr] sm:items-center ${result ? (result[i] ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-rose-500 bg-rose-50 dark:bg-rose-900/30') : 'border-slate-200 dark:border-slate-700'}`}>
            <span className="text-sm font-semibold">{left}</span>
            <div>
              <select
                className="input"
                disabled={done}
                value={picks[i] ?? ''}
                onChange={(e) => setPicks((p) => p.map((x, k) => (k === i ? e.target.value || undefined : x)))}
                aria-label={`Match for ${left}`}
              >
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              {result && !result[i] && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">✓ {ans}</p>}
            </div>
          </div>
        ))}
      </div>
      {!done ? (
        <button
          className="btn-primary w-full"
          disabled={picks.some((p) => !p)}
          onClick={() => {
            setDone(true);
            const r = checkMatching(m, picks);
            onDone(r.filter(Boolean).length, r.length);
          }}
        >
          Check matches
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{right}/{m.pairs.length} matched</p>
          <Source src={m.src} />
          <button className="btn-primary" onClick={onNext} autoFocus>Next ↵</button>
        </div>
      )}
    </div>
  );
}

/** Fill in the blank, forgiving case, punctuation, articles and plurals. */
export function FillCard({ f, onDone, onNext }: { f: FillBlank; onDone: (correct: boolean) => void; onNext: () => void }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState<boolean | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [before, after] = f.text.split('___');
  const submit = () => {
    if (done !== null || !text.trim()) return;
    const ok = checkFill(f, text);
    setDone(ok);
    onDone(ok);
    setTimeout(() => nextRef.current?.focus(), 0);
  };
  return (
    <div className="card animate-pop space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">Fill in the blank</span>
      </div>
      <p className="font-medium leading-relaxed sm:text-lg">
        {before}
        <span className="mx-1 inline-block min-w-16 border-b-2 border-brand-500 px-1 text-brand-700 dark:text-brand-300">{done !== null ? (done ? text : f.answer) : ' '}</span>
        {after}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input className="input" autoFocus disabled={done !== null} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type the missing term" aria-label="Answer" />
        {done === null && <button className="btn-primary shrink-0" disabled={!text.trim()}>Check</button>}
      </form>
      {done !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{done ? 'Correct!' : `Not quite — the answer is “${f.answer}”. You wrote “${text}”.`}</p>
          <Source src={f.src} />
          <button ref={nextRef} className="btn-primary" onClick={onNext}>Next ↵</button>
        </div>
      )}
    </div>
  );
}
