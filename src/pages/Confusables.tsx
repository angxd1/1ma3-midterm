import { useMemo, useState } from 'react';
import type { Confusable } from '../content/types';
import { content, mcqById } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { record } from '../lib/store';
import { shuffle } from '../lib/drills';
import { McqCard } from '../components/McqCard';
import { Source } from '../components/ConceptPanel';

function Table({ c }: { c: Confusable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="w-28 p-2" />
            {c.columns.map((col) => <th key={col} className="border-b-2 border-brand-500 p-2 font-bold">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.aspect} className="border-b border-slate-200 align-top dark:border-slate-800">
              <th className="p-2 text-xs font-semibold text-slate-500">{r.aspect}</th>
              {r.cells.map((cell, i) => <td key={i} className="p-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Side-by-side comparison cards for concepts students mix up, each with a quick drill. */
export default function Confusables() {
  const attempts = useAttempts();
  const [open, setOpen] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ ids: string[]; pos: number; right: number; title: string } | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { right: number; total: number }>();
    for (const c of content.confusables) {
      const ids = new Set(c.questionIds);
      const last = new Map<string, boolean>();
      for (const a of attempts) if (ids.has(a.questionId)) last.set(a.questionId, a.correct);
      m.set(c.id, { right: [...last.values()].filter(Boolean).length, total: c.questionIds.length });
    }
    return m;
  }, [attempts]);

  if (drill) {
    const qid = drill.ids[drill.pos];
    if (!qid) {
      return (
        <div className="card mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-4xl">🔀</p>
          <p className="text-xl font-bold">{drill.right}/{drill.ids.length} correct</p>
          <p className="text-sm text-slate-500">{drill.title}</p>
          <button className="btn-primary" onClick={() => setDrill(null)}>Back to pairs</button>
        </div>
      );
    }
    const q = mcqById.get(qid)!;
    const card = content.confusables.find((c) => c.questionIds.includes(qid));
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center justify-between text-sm">
          <button className="text-brand-600 hover:underline" onClick={() => setDrill(null)}>← Pairs</button>
          <span className="tabular-nums">{drill.pos + 1}/{drill.ids.length} · {drill.right} right</span>
        </div>
        <McqCard
          key={`${qid}-${drill.pos}`}
          q={q}
          header={<span className="chip bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">🔀 {card?.title}</span>}
          onAnswered={(r) => {
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'confusable', meta: { ms: r.ms, chosen: r.chosen } });
            if (r.correct) setDrill((d) => (d ? { ...d, right: d.right + 1 } : d));
          }}
          onNext={() => setDrill((d) => (d ? { ...d, pos: d.pos + 1 } : d))}
        />
        {card && (
          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">Peek at the comparison</summary>
            <div className="mt-3 space-y-2"><Table c={card} /><p className="text-xs">💡 {card.tip}</p></div>
          </details>
        )}
      </div>
    );
  }

  const all = content.confusables.flatMap((c) => c.questionIds);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">🔀 Confusable pairs</h1>
          <p className="text-sm text-slate-500">{content.confusables.length} groups of concepts that are easy to mix up, side by side.</p>
        </div>
        <button className="btn-primary" onClick={() => setDrill({ ids: shuffle(all).slice(0, 20), pos: 0, right: 0, title: 'Mixed drill (20 questions)' })}>Mixed drill</button>
      </div>
      {content.confusables.map((c) => {
        const s = stats.get(c.id)!;
        const isOpen = open === c.id;
        return (
          <div key={c.id} className="card space-y-3">
            <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
              <span className="font-semibold">{c.title}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                <span className={`chip ${s.right === s.total ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>{s.right}/{s.total}</span>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && (
              <>
                <Table c={c} />
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">💡 {c.tip}</p>
                {c.src && <Source src={c.src} />}
                <button className="btn-primary" onClick={() => setDrill({ ids: shuffle(c.questionIds), pos: 0, right: 0, title: c.title })}>Drill these ({c.questionIds.length})</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
