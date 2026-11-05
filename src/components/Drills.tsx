import { useMemo, useRef, useState } from 'react';
import type { FillBlank, Matching } from '../content/types';
import { checkFill, checkMatching, shuffle } from '../lib/drills';
import { Source } from './ConceptPanel';
import { ChapterChip, tabStyle } from './ui';

/** Match each left-hand item to a right-hand option (dropdowns, so it works on phones). */
export function MatchingCard({ m, onDone, onNext }: { m: Matching; onDone: (right: number, total: number) => void; onNext: () => void }) {
  const options = useMemo(() => shuffle(m.pairs.map(([, r]) => r)), [m.id]);
  const [picks, setPicks] = useState<(string | undefined)[]>(() => m.pairs.map(() => undefined));
  const [done, setDone] = useState(false);
  const result = done ? checkMatching(m, picks) : null;
  const right = result?.filter(Boolean).length ?? 0;
  return (
    <div className="sheet space-y-4" style={tabStyle(m.chapter)}>
      <div className="flex flex-wrap items-center gap-x-3">
        <ChapterChip ch={m.chapter} />
        <span className="text-xs font-semibold text-ink">Matching</span>
      </div>
      <p className="font-serif text-[19px] leading-relaxed sm:text-[21px]">{m.prompt}</p>
      <div className="space-y-2">
        {m.pairs.map(([left, ans], i) => (
          <div key={left} className={`grid gap-2 border-l-2 py-1 pl-3 sm:grid-cols-[1fr_1.4fr] sm:items-center ${result ? (result[i] ? 'border-tick' : 'border-redpen') : 'border-rule'}`}>
            <span className="text-[15px] font-semibold">{left} {result && <span className={result[i] ? 'text-tick' : 'text-redpen'}>{result[i] ? '✓' : '✗'}</span>}</span>
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
              {result && !result[i] && <p className="mt-1 text-[13px]">Answer: <span className="hl">{ans}</span></p>}
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
          <p className="text-[15px] font-semibold">{right} of {m.pairs.length} matched</p>
          <Source src={m.src} />
          <button className="btn-primary" onClick={onNext} autoFocus>Next question</button>
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
    <div className="sheet space-y-4" style={tabStyle(f.chapter)}>
      <div className="flex flex-wrap items-center gap-x-3">
        <ChapterChip ch={f.chapter} />
        <span className="text-xs font-semibold text-ink">Fill in the blank</span>
      </div>
      <p className="font-serif text-[19px] leading-relaxed sm:text-[21px]">
        {before}
        <span className={`mx-1 inline-block min-w-16 border-b-2 px-1 ${done === null ? 'border-ink' : done ? 'border-tick' : 'border-redpen'}`}>{done !== null ? <span className="hl animate-swipe">{done ? text : f.answer}</span> : '\u00a0'}</span>
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
        {done === null && <button className="btn-primary shrink-0" disabled={!text.trim()}>Check answer</button>}
      </form>
      {done !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-[15px] font-semibold ${done ? 'text-tick' : 'text-redpen'}`}>{done ? 'Correct.' : `Not quite. The answer is “${f.answer}”; you wrote “${text}”.`}</p>
          <Source src={f.src} />
          <button ref={nextRef} className="btn-primary" onClick={onNext}>Next question</button>
        </div>
      )}
    </div>
  );
}
