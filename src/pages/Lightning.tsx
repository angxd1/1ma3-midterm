import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, type ChapterId } from '../content/types';
import type { Mcq } from '../content/types';
import { content, canShuffle, CHAPTER_SHORT } from '../lib/content';
import { useAttempts, useNow } from '../lib/hooks';
import { record } from '../lib/store';
import { seenConcepts } from '../lib/stats';
import { LIGHTNING_PENALTY_S, LIGHTNING_SECONDS, lightningPool, shuffle } from '../lib/drills';
import { Source } from '../components/ConceptPanel';
import { ChapterChip, HlBar, TAB, tabStyle } from '../components/ui';

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
          <h1 className="text-[26px] font-extrabold leading-tight">Lightning round</h1>
          {run && done ? (
            <div className="text-center">
              <p className="text-5xl font-extrabold tabular-nums">{run.right}</p>
              <p className="text-sm text-pencil">right in {LIGHTNING_SECONDS} seconds, out of {run.log.length} answered{run.right > 0 && run.right >= best ? ' · 🎉 personal best!' : ` · best ${best}`}</p>
            </div>
          ) : (
            <p className="text-sm text-ink/85">
              {LIGHTNING_SECONDS} seconds. Answer as many quick questions as you can — tap or press 1–4. A wrong answer costs {LIGHTNING_PENALTY_S} seconds. Questions come from concepts you've already seen
              {seenCount < 10 ? ' (or the whole chapter set until you’ve seen a few)' : ''}. Personal best: <b>{best}</b>.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {CHAPTERS.map((c) => {
              const on = chapters.includes(c);
              return (
                <button key={c} onClick={() => setChapters((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))} className={`chip border px-3 py-1.5 text-sm ${on ? 'on' : 'off'}`}>
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TAB[c] }} />Ch {c} {CHAPTER_SHORT[c]}
                </button>
              );
            })}
          </div>
          <button className="btn-primary w-full" disabled={!chapters.length} onClick={start}>{run ? 'Go again' : 'Start'}</button>
        </div>
        {misses.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[21px] font-extrabold">Missed <span className="text-pencil">{misses.length}</span></h2>
            {misses.map(({ q, chosen }, i) => (
              <div key={i} className="space-y-1 border-t border-rule py-3 text-[15px]">
                <p className="font-serif text-[17px]">{q.q}</p>
                <p><span className="text-pencil">You picked </span><span className="strike">{q.options[chosen]}</span></p>
                <p><span className="text-pencil">Answer </span><span className="hl font-semibold">{q.options[q.answer]}</span> <span className="text-ink/85">{q.explanations[q.answer]}</span></p>
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
      <div className="flex items-baseline justify-between">
        <span className={`text-[33px] font-extrabold tabular-nums ${frac < 0.25 ? 'text-redpen' : ''}`} aria-label="Seconds left">{Math.ceil(left / 1000)}s</span>
        <span className="text-[21px] font-extrabold tabular-nums"><span key={run.right} className="hl animate-swipe">{run.right}</span> <span className="text-[15px] font-normal text-pencil">right</span></span>
      </div>
      <HlBar value={frac} tone={frac < 0.25 ? 'redpen' : 'hl'} thick label="Time left" />
      <div key={run.log.length} className={`sheet space-y-4 ${run.flash === 'ok' ? 'outline outline-2 outline-tick' : run.flash === 'bad' ? 'outline outline-2 outline-redpen' : ''}`} style={tabStyle(q.chapter)}>
        <ChapterChip ch={q.chapter} />
        <p className="font-serif text-[19px] leading-relaxed">{q.q}</p>
        <div className="grid gap-2">
          {run.order.map((orig, i) => (
            <button key={orig} onClick={() => answer(orig)} className="flex items-start gap-3 rounded-md border border-rule p-3 text-left text-[15px] hover:border-pencil/60 active:bg-brand-50 sm:text-base">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-rule text-xs font-bold text-pencil">{i + 1}</span>
              <span>{q.options[orig]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
