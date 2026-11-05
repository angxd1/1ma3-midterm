import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterId } from '../content/types';
import { CHAPTERS } from '../content/types';
import { conceptById, mcqById, relatedIds, CHAPTER_SHORT } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { pendingMistakes } from '../lib/stats';
import { getKv, record, setKv, useStore } from '../lib/store';
import type { Attempt } from '../lib/types';
import { McqCard } from '../components/McqCard';
import { Source } from '../components/ConceptPanel';

type Filter = 'owed' | 'fixed' | 'all';

interface Entry {
  qid: string;
  misses: number;
  lastWrong: Attempt;
  sureWrong: boolean;
  owed: boolean;
}

function Note({ qid }: { qid: string }) {
  const key = `note:${qid}`;
  const saved = useStore((s) => (s.kv[key]?.value as string | undefined) ?? '');
  const [text, setText] = useState(saved);
  return (
    <textarea
      className="input min-h-[2.5rem] text-xs"
      placeholder="Your note — why you got it wrong, a memory hook…"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== (getKv<string>(key) ?? '') && setKv(key, text)}
    />
  );
}

function MistakeCard({ e, onRetry }: { e: Entry; onRetry: () => void }) {
  const q = mcqById.get(e.qid)!;
  const concept = conceptById.get(q.concepts[0]);
  const chosen = typeof e.lastWrong.meta?.chosen === 'number' ? (e.lastWrong.meta.chosen as number) : undefined;
  const [open, setOpen] = useState(false);
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`chip ${e.owed ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>{e.owed ? 'Still owed' : 'Fixed ✓'}</span>
        {e.sureWrong && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="You marked “Sure” and got it wrong: a misconception, not a gap">⚠️ You were sure</span>}
        <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ch {q.chapter} · {concept?.title}</span>
        <span className="text-slate-500">missed {e.misses}× · last {new Date(e.lastWrong.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
      <p className="font-medium">{q.q}</p>
      <div className="space-y-1 text-sm">
        {chosen !== undefined && chosen !== q.answer && <p className="text-rose-700 dark:text-rose-300">✗ You chose: {q.options[chosen]}</p>}
        <p className="text-emerald-700 dark:text-emerald-300">✓ Answer: {q.options[q.answer]}</p>
      </div>
      {open && (
        <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          {q.options.map((_, i) => (
            <li key={i} className={i === q.answer ? 'font-medium text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-slate-300'}>
              {i === q.answer ? '✓ ' : '✗ '}{q.explanations[i]}
            </li>
          ))}
          <li className="pt-1"><Source src={q.src} /></li>
        </ul>
      )}
      <Note qid={e.qid} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary px-3 py-1.5" onClick={onRetry}>Retry</button>
        <button className="btn-ghost px-3 py-1.5" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Why'} each option</button>
        {concept && <Link className="btn-ghost px-3 py-1.5" to={`/lesson/${concept.id}`}>Relearn concept</Link>}
      </div>
    </div>
  );
}

/** Mistake notebook: every MCQ ever answered wrong, with what you picked, the fix, and your own notes. */
export default function Mistakes() {
  const attempts = useAttempts();
  const [filter, setFilter] = useState<Filter>('owed');
  const [chapter, setChapter] = useState<ChapterId | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);

  const entries = useMemo(() => {
    const owed = new Set(pendingMistakes(attempts, relatedIds));
    const by = new Map<string, Entry>();
    for (const a of attempts) {
      if (a.correct || !mcqById.has(a.questionId)) continue;
      const e = by.get(a.questionId) ?? { qid: a.questionId, misses: 0, lastWrong: a, sureWrong: false, owed: owed.has(a.questionId) };
      e.misses++;
      if (a.ts >= e.lastWrong.ts) e.lastWrong = a;
      if (a.confidence === 'sure') e.sureWrong = true;
      by.set(a.questionId, e);
    }
    // Misconceptions (sure but wrong) first, then the most-missed, then most recent.
    return [...by.values()].sort((x, y) => Number(y.sureWrong) - Number(x.sureWrong) || y.misses - x.misses || y.lastWrong.ts - x.lastWrong.ts);
  }, [attempts]);

  const inChapter = entries.filter((e) => !chapter || mcqById.get(e.qid)!.chapter === chapter);
  const shown = inChapter.filter((e) => (filter === 'all' ? true : filter === 'owed' ? e.owed : !e.owed));
  const owedCount = inChapter.filter((e) => e.owed).length;

  if (queue) {
    const qid = queue[pos];
    if (!qid) {
      return (
        <div className="card mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-4xl">🩹</p>
          <p className="text-xl font-bold">Review done: {right}/{queue.length} fixed</p>
          <p className="text-sm text-slate-500">Anything you missed again stays in the notebook and comes back in practice.</p>
          <button className="btn-primary" onClick={() => setQueue(null)}>Back to notebook</button>
        </div>
      );
    }
    const q = mcqById.get(qid)!;
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center justify-between text-sm">
          <button className="text-brand-600 hover:underline" onClick={() => setQueue(null)}>← Notebook</button>
          <span className="tabular-nums">{pos + 1} / {queue.length} · {right} fixed</span>
        </div>
        <McqCard
          key={`${qid}-${pos}`}
          q={q}
          header={<span className="chip bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Mistake review</span>}
          onAnswered={(r) => {
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'review', meta: { ms: r.ms, chosen: r.chosen } });
            if (r.correct) setRight((n) => n + 1);
          }}
          onNext={() => setPos((p) => p + 1)}
          nextLabel={pos + 1 < queue.length ? 'Next' : 'Finish'}
        />
      </div>
    );
  }

  const startReview = (ids: string[]) => {
    setQueue(ids);
    setPos(0);
    setRight(0);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">🩹 Mistake notebook</h1>
            <p className="text-sm text-slate-500">Every question you've missed. “Still owed” clears once you get it (or a sibling question) right.</p>
          </div>
          <button className="btn-primary" disabled={!owedCount} onClick={() => startReview(inChapter.filter((e) => e.owed).map((e) => e.qid))}>
            Review {owedCount} owed
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['owed', 'fixed', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip border px-3 py-1.5 text-sm ${filter === f ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {f === 'owed' ? `Still owed (${owedCount})` : f === 'fixed' ? `Fixed (${inChapter.length - owedCount})` : `All (${inChapter.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setChapter(null)} className={`chip shrink-0 border px-3 py-1 ${!chapter ? 'border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900' : 'border-slate-300 dark:border-slate-700'}`}>All chapters</button>
          {CHAPTERS.map((c) => (
            <button key={c} onClick={() => setChapter(c)} className={`chip shrink-0 border px-3 py-1 ${chapter === c ? 'border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900' : 'border-slate-300 dark:border-slate-700'}`}>
              Ch {c} · {CHAPTER_SHORT[c]}
            </button>
          ))}
        </div>
      </div>

      {!entries.length ? (
        <div className="card text-center text-sm text-slate-500">No mistakes yet. Anything you get wrong in lessons, practice or a mock lands here.</div>
      ) : !shown.length ? (
        <div className="card text-center text-sm text-slate-500">{filter === 'owed' ? 'Nothing owed here — nice work. 🎉' : 'Nothing in this view.'}</div>
      ) : (
        shown.map((e) => <MistakeCard key={e.qid} e={e} onRetry={() => startReview([e.qid])} />)
      )}
    </div>
  );
}
