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
      <table className="w-full min-w-[28rem] border-collapse text-left text-[15px]">
        <thead>
          <tr>
            <th className="w-28 p-2" />
            {c.columns.map((col) => <th key={col} className="border-b-2 border-ink p-2 font-extrabold"><span className="hl">{col}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.aspect} className="border-b border-rule align-top">
              <th className="p-2 text-[13px] font-semibold text-pencil">{r.aspect}</th>
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
          <p className="text-[26px] font-extrabold leading-tight">{drill.right}/{drill.ids.length} correct</p>
          <p className="text-sm text-pencil">{drill.title}</p>
          <button className="btn-primary" onClick={() => setDrill(null)}>Back to pairs</button>
        </div>
      );
    }
    const q = mcqById.get(qid)!;
    const card = content.confusables.find((c) => c.questionIds.includes(qid));
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center justify-between text-sm">
          <button className="text-[15px] text-pencil hover:text-ink" onClick={() => setDrill(null)}>Pairs</button>
          <span className="tabular-nums">Question {drill.pos + 1} of {drill.ids.length}, {drill.right} right</span>
        </div>
        <McqCard
          key={`${qid}-${drill.pos}`}
          q={q}
          header={<span className="text-xs font-semibold text-ink">{card?.title}</span>}
          onAnswered={(r) => {
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'confusable', meta: { ms: r.ms, chosen: r.chosen } });
            if (r.correct) setDrill((d) => (d ? { ...d, right: d.right + 1 } : d));
          }}
          onNext={() => setDrill((d) => (d ? { ...d, pos: d.pos + 1 } : d))}
        />
        {card && (
          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">Peek at the comparison table</summary>
            <div className="mt-3 space-y-2"><Table c={card} /><p className="text-[13px]"><b>Memory tip:</b> {card.tip}</p></div>
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
          <h1 className="text-[26px] font-extrabold leading-tight">Confusable pairs</h1>
          <p className="text-sm text-pencil">{content.confusables.length} groups of concepts that are easy to mix up, side by side.</p>
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
              <span className="flex shrink-0 items-center gap-2 text-xs text-pencil">
                <span className={`chip ${s.right === s.total ? 'text-tick' : 'bg-paper'}`}>{s.right}/{s.total}</span>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && (
              <>
                <Table c={c} />
                <p className="border-l-2 border-hl pl-3 text-[15px]"><b>Memory tip:</b> {c.tip}</p>
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
