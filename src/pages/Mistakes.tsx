import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterId } from '../content/types';
import { conceptById, mcqById, relatedIds } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { pendingMistakes } from '../lib/stats';
import { getKv, record, setKv, useStore } from '../lib/store';
import type { Attempt } from '../lib/types';
import { McqCard } from '../components/McqCard';
import { Source } from '../components/ConceptPanel';
import { ChapterChip, ChapterTabs } from '../components/ui';

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
      className="input min-h-[5rem] border-dashed bg-transparent font-serif text-[15px]"
      placeholder="Why you got it wrong, or a memory hook"
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
    <li className="grid gap-x-6 gap-y-3 py-5 md:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <ChapterChip ch={q.chapter} title={concept?.title} />
          <span className={e.owed ? 'font-semibold text-redpen' : 'font-semibold text-tick'}>{e.owed ? 'Still owed' : 'Fixed'}</span>
          {e.sureWrong && <span className="font-semibold text-ink" title="You marked “Sure” and got it wrong, which points to a misunderstanding rather than a gap"><span className="hl">You were sure</span></span>}
          <span className="text-pencil">Missed {e.misses === 1 ? 'once' : `${e.misses} times`}, last on {new Date(e.lastWrong.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        <p className="max-w-[68ch] font-serif text-[17px] leading-relaxed">{q.q}</p>
        <div className="space-y-1 text-[15px]">
          {chosen !== undefined && chosen !== q.answer && <p><span className="text-pencil">You picked </span><span className="strike">{q.options[chosen]}</span></p>}
          <p><span className="text-pencil">Answer </span><span className="hl font-semibold">{q.options[q.answer]}</span></p>
        </div>
        {open && (
          <ul className="space-y-1.5 border-l-2 border-rule pl-3 text-[15px]">
            {q.options.map((opt, i) => (
              <li key={i} className={i === q.answer ? 'text-ink' : 'text-pencil'}>
                <b className={i === q.answer ? 'text-tick' : ''}>{opt}:</b> {q.explanations[i]}
              </li>
            ))}
            <li className="pt-1"><Source src={q.src} /></li>
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary px-3 py-1.5" onClick={onRetry}>Retry this question</button>
          <button className="btn-ghost px-3 py-1.5" onClick={() => setOpen((v) => !v)}>{open ? 'Hide reasons' : 'Why each option'}</button>
          {concept && <Link className="btn-ghost px-3 py-1.5" to={`/lesson/${concept.id}`}>Relearn the concept</Link>}
        </div>
      </div>
      <div className="md:border-l md:border-dashed md:border-rule md:pl-4">
        <p className="mb-1 text-[13px] text-pencil">Margin note</p>
        <Note qid={e.qid} />
      </div>
    </li>
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
        <div className="card mx-auto max-w-2xl space-y-3 text-center sm:p-6">
          <p className="text-[26px] font-extrabold leading-tight">Review done</p>
          <p className="text-[17px]">You fixed <span className="hl font-semibold">{right} of {queue.length}</span>.</p>
          <p className="text-[15px] text-pencil">Anything you missed again stays in the notebook and comes back in practice.</p>
          <button className="btn-primary" onClick={() => setQueue(null)}>Back to the notebook</button>
        </div>
      );
    }
    const q = mcqById.get(qid)!;
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center justify-between text-[15px]">
          <button className="text-pencil hover:text-ink" onClick={() => setQueue(null)}>Back to the notebook</button>
          <span className="tabular-nums text-pencil">Question {pos + 1} of {queue.length}, {right} fixed</span>
        </div>
        <McqCard
          key={`${qid}-${pos}`}
          q={q}
          header={<span className="text-xs font-semibold text-redpen">Mistake review</span>}
          onAnswered={(r) => {
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'review', meta: { ms: r.ms, chosen: r.chosen } });
            if (r.correct) setRight((n) => n + 1);
          }}
          onNext={() => setPos((p) => p + 1)}
          nextLabel={pos + 1 < queue.length ? 'Next question' : 'Finish review'}
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
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[33px] font-extrabold leading-tight tracking-tight">Mistake notebook</h1>
            <p className="max-w-[60ch] text-[15px] text-pencil">Every question you've missed. A mistake stops being owed once you get it, or a closely related question, right.</p>
          </div>
          <button className="btn-primary" disabled={!owedCount} onClick={() => startReview(inChapter.filter((e) => e.owed).map((e) => e.qid))}>
            Review {owedCount} owed
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['owed', 'fixed', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip border px-3 py-1.5 text-sm ${filter === f ? 'on' : 'off'}`}>
              {f === 'owed' ? `Still owed (${owedCount})` : f === 'fixed' ? `Fixed (${inChapter.length - owedCount})` : `All (${inChapter.length})`}
            </button>
          ))}
        </div>
        <ChapterTabs all active={chapter ?? 'all'} onSelect={(c) => setChapter(c === 'all' ? null : c)} />
      </div>

      {!entries.length ? (
        <p className="py-10 text-center text-[15px] text-pencil">No mistakes yet. Anything you get wrong in lessons, practice or a mock lands here.</p>
      ) : !shown.length ? (
        <p className="py-10 text-center text-[15px] text-pencil">{filter === 'owed' ? 'Nothing owed in this view. Switch to “Fixed” to look back over old mistakes.' : 'Nothing in this view yet.'}</p>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">{shown.map((e) => <MistakeCard key={e.qid} e={e} onRetry={() => startReview([e.qid])} />)}</ul>
      )}
    </div>
  );
}
