import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, type ChapterId } from '../content/types';
import type { Mcq } from '../content/types';
import { content, canShuffle, CHAPTER_SHORT } from '../lib/content';
import { useAttempts, useNow } from '../lib/hooks';
import { record } from '../lib/store';
import { seenConcepts } from '../lib/stats';
import { LIGHTNING_PENALTY_S, LIGHTNING_SECONDS, lightningPool, shuffle } from '../lib/drills';
import { Source } from '../components/ConceptPanel';

interface Run {
  id: string;
  queue: Mcq[];
  pos: number;
  order: number[];
  endsAt: number;
  right: number;
  log: { q: Mcq; chosen: number; ok: boolean }[];
  flash: 'ok' | 'bad' | null;
}

const orderFor = (q: Mcq) => (canShuffle(q) ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i));

/** 60-second speed round: tap answers as fast as you can; a miss costs 3 seconds. */
export default function Lightning() {
  const attempts = useAttempts();
  const [chapters, setChapters] = useState<ChapterId[]>([...CHAPTERS]);
  const [run, setRun] = useState<Run | null>(null);
  const [done, setDone] = useState(false);
  const now = useNow(100);
  const shown = useRef(Date.now());
  const best = useMemo(() => Math.max(0, ...attempts.filter((a) => a.questionId.startsWith('lightning:')).map((a) => Number(a.meta?.score ?? 0))), [attempts]);
  const seenCount = useMemo(() => seenConcepts(attempts).size, [attempts]);

  const left = run ? Math.min(LIGHTNING_SECONDS * 1000, Math.max(0, run.endsAt - now)) : LIGHTNING_SECONDS * 1000;

  useEffect(() => {
    if (run && !done && left <= 0) {
      setDone(true);
      record({ questionId: `lightning:${run.id}`, conceptIds: [], correct: true, confidence: null, mode: 'lightning', meta: { score: run.right, answered: run.log.length } });
    }
  }, [left, run, done]);

  const start = () => {
    const pool = shuffle(lightningPool(content, seenConcepts(attempts), chapters));
    setRun({ id: crypto.randomUUID(), queue: pool, pos: 0, order: orderFor(pool[0]), endsAt: Date.now() + LIGHTNING_SECONDS * 1000, right: 0, log: [], flash: null });
    setDone(false);
    shown.current = Date.now();
  };

  const answer = (orig: number) => {
    if (!run || done) return;
    const q = run.queue[run.pos];
    const ok = orig === q.answer;
    record({ questionId: q.id, conceptIds: q.concepts, correct: ok, confidence: null, mode: 'lightning', meta: { ms: Date.now() - shown.current, chosen: orig } });
    const pos = (run.pos + 1) % run.queue.length;
    setRun({ ...run, pos, order: orderFor(run.queue[pos]), right: run.right + (ok ? 1 : 0), endsAt: ok ? run.endsAt : run.endsAt - LIGHTNING_PENALTY_S * 1000, log: [...run.log, { q, chosen: orig, ok }], flash: ok ? 'ok' : 'bad' });
    shown.current = Date.now();
  };

  useEffect(() => {
    if (!run || done) return;
    const h = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= run.order.length) answer(run.order[n - 1]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!run || done) {
    const misses = run?.log.filter((l) => !l.ok) ?? [];
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card space-y-4">
          <h1 className="text-xl font-bold">⚡ Lightning round</h1>
          {run && done ? (
            <div className="text-center">
              <p className="text-5xl font-extrabold tabular-nums">{run.right}</p>
              <p className="text-sm text-slate-500">correct in {LIGHTNING_SECONDS}s · {run.log.length} answered{run.right > 0 && run.right >= best ? ' · 🎉 personal best!' : ` · best ${best}`}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {LIGHTNING_SECONDS} seconds. Answer as many quick questions as you can — tap or press 1–4. A wrong answer costs {LIGHTNING_PENALTY_S} seconds. Questions come from concepts you've already seen
              {seenCount < 10 ? ' (or the whole chapter set until you’ve seen a few)' : ''}. Personal best: <b>{best}</b>.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {CHAPTERS.map((c) => {
              const on = chapters.includes(c);
              return (
                <button key={c} onClick={() => setChapters((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))} className={`chip border px-3 py-1.5 text-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                  Ch {c} · {CHAPTER_SHORT[c]}
                </button>
              );
            })}
          </div>
          <button className="btn-primary w-full" disabled={!chapters.length} onClick={start}>{run ? 'Go again' : 'Start'}</button>
        </div>
        {misses.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-bold">Missed ({misses.length})</h2>
            {misses.map(({ q, chosen }, i) => (
              <div key={i} className="space-y-1 border-t border-slate-200 pt-2 text-sm first:border-0 first:pt-0 dark:border-slate-800">
                <p className="font-medium">{q.q}</p>
                <p className="text-rose-700 dark:text-rose-300">✗ {q.options[chosen]}</p>
                <p className="text-emerald-700 dark:text-emerald-300">✓ {q.options[q.answer]} — {q.explanations[q.answer]}</p>
                <Source src={q.src} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const q = run.queue[run.pos];
  const frac = left / (LIGHTNING_SECONDS * 1000);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-2xl font-extrabold tabular-nums">{Math.ceil(left / 1000)}s</span>
        <span className="text-lg font-bold tabular-nums">⚡ {run.right}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${frac < 0.25 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${frac * 100}%` }} />
      </div>
      <div key={run.log.length} className={`card space-y-3 ring-2 ${run.flash === 'ok' ? 'ring-emerald-400' : run.flash === 'bad' ? 'ring-rose-400' : 'ring-transparent'}`}>
        <p className="text-xs text-slate-500">Ch {q.chapter}</p>
        <p className="font-medium sm:text-lg">{q.q}</p>
        <div className="grid gap-2">
          {run.order.map((orig, i) => (
            <button key={orig} onClick={() => answer(orig)} className="flex items-start gap-3 rounded-xl border-2 border-slate-200 p-3 text-left text-sm hover:border-brand-400 active:bg-brand-50 dark:border-slate-700 dark:active:bg-brand-700/20 sm:text-base">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold dark:bg-slate-800">{i + 1}</span>
              <span>{q.options[orig]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
