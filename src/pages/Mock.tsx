import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { content, mcqById, saById, conceptById, relatedIds, canShuffle, CHAPTER_SHORT } from '../lib/content';
import { composeMock, MOCK_MINUTES, type MockPaper } from '../lib/mock';
import { record, setKv, useStore, getState, visibleAttempts } from '../lib/store';
import { useAttempts, useNow } from '../lib/hooks';
import { ShortAnswerCard } from '../components/ShortAnswerCard';
import { Source } from '../components/ConceptPanel';
import { CHAPTERS } from '../content/types';
import { ChapterChip, HlBar, tabStyle } from '../components/ui';

interface MockState {
  paper: MockPaper;
  orders: Record<string, number[]>; // display order of original option indexes
  startedAt: number;
  deadline: number;
  answers: Record<string, number>; // qid -> original option index
  flags: string[];
  saText: [string, string];
  timeMs: Record<string, number>;
  current: number; // 0..59 MCQs, 60..61 short answers
  submitted?: number; // submit time
  saMarks?: Record<string, { score: number; outOf: number }>;
}

const TOTAL = (p: MockPaper) => p.mcqIds.length + 2;
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function startMock(): MockState {
  const paper = composeMock(content, visibleAttempts(getState()), Math.random, relatedIds);
  const orders: Record<string, number[]> = {};
  for (const id of paper.mcqIds) {
    const q = mcqById.get(id)!;
    const idx = q.options.map((_, i) => i);
    if (canShuffle(q)) for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    orders[id] = idx;
  }
  const now = Date.now();
  return { paper, orders, startedAt: now, deadline: now + MOCK_MINUTES * 60_000, answers: {}, flags: [], saText: ['', ''], timeMs: {}, current: 0 };
}

export default function Mock() {
  const stored = useStore((s) => s.kv['mock']?.value as MockState | null | undefined);
  const now = useNow(1000);
  const [view, setView] = useState<MockState | null>(stored ?? null);
  const lastTick = useRef(Date.now());

  // Adopt changes synced from another device.
  useEffect(() => {
    if (stored && (!view || stored.paper.id !== view.paper.id || (stored.submitted && !view.submitted))) setView(stored);
    if (stored === null && view) setView(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const save = (m: MockState | null) => {
    setView(m);
    setKv('mock', m);
  };

  const curId = view && !view.submitted ? (view.current < view.paper.mcqIds.length ? view.paper.mcqIds[view.current] : view.paper.saIds[view.current - view.paper.mcqIds.length]) : null;
  const accrue = (m: MockState): MockState => {
    const t = Date.now();
    const id = curId;
    const delta = t - lastTick.current;
    lastTick.current = t;
    if (!id || delta > 10 * 60_000) return m;
    return { ...m, timeMs: { ...m.timeMs, [id]: (m.timeMs[id] ?? 0) + delta } };
  };

  const submit = (m: MockState) => {
    const final = { ...accrue(m), submitted: Date.now() };
    for (const id of final.paper.mcqIds) {
      const q = mcqById.get(id)!;
      const ans = final.answers[id];
      record({ questionId: id, conceptIds: q.concepts, correct: ans === q.answer, confidence: null, mode: 'mock', meta: { mockId: final.paper.id, ms: final.timeMs[id] ?? 0, skipped: ans === undefined, chosen: ans } });
    }
    record({ questionId: `mock:${final.paper.id}`, conceptIds: [], correct: true, confidence: null, mode: 'mock', meta: { score: final.paper.mcqIds.filter((id) => final.answers[id] === mcqById.get(id)!.answer).length, of: final.paper.mcqIds.length } });
    save(final);
  };

  // Auto-submit when time runs out (also if the deadline passed while the app was closed).
  useEffect(() => {
    if (view && !view.submitted && now >= view.deadline) submit(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, view]);

  // Keyboard: 1–5 answer, F flag, ←/→ navigate.
  useEffect(() => {
    if (!view || view.submitted) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const id = curId;
      if (!id) return;
      const q = mcqById.get(id);
      const n = Number(e.key);
      if (q && n >= 1 && n <= q.options.length) save({ ...view, answers: { ...view.answers, [id]: view.orders[id][n - 1] } });
      else if (e.key === 'f' || e.key === 'F') save({ ...view, flags: view.flags.includes(id) ? view.flags.filter((x) => x !== id) : [...view.flags, id] });
      else if (e.key === 'ArrowRight' || e.key === 'Enter') go(Math.min(view.current + 1, TOTAL(view.paper) - 1));
      else if (e.key === 'ArrowLeft') go(Math.max(view.current - 1, 0));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const go = (i: number) => view && save({ ...accrue(view), current: i });

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card space-y-4 sm:p-6">
          <h1 className="text-[26px] font-extrabold leading-tight">Timed mock midterm</h1>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink/85">
            <li>60 multiple-choice questions (~10 per chapter) + 2 short answers, 2-hour countdown, auto-submits when time runs out.</li>
            <li>Mixes in official and past-midterm questions and prioritises what you've previously got wrong.</li>
            <li>Short answers: one from Chapter 4, one from Chapters 3, 6, 8 or 9 (never Chapter 7).</li>
            <li>No feedback until you submit. Use the scantron grid to jump, and flag questions to review (F).</li>
            <li>Progress is saved continuously, so you can close the tab or switch devices and resume.</li>
          </ul>
          <button className="btn-primary w-full" onClick={() => { lastTick.current = Date.now(); save(startMock()); }}>Start the 2-hour mock</button>
        </div>
      </div>
    );
  }

  if (view.submitted) return <Results m={view} onMark={(saId, score, outOf) => save({ ...view, saMarks: { ...view.saMarks, [saId]: { score, outOf } } })} onNew={() => save(null)} />;

  const p = view.paper;
  const remaining = view.deadline - now;
  const answered = p.mcqIds.filter((id) => view.answers[id] !== undefined).length;
  const isSa = view.current >= p.mcqIds.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="sticky top-[57px] z-10 flex items-center justify-between gap-3 rounded-md border border-rule bg-sheet/95 px-4 py-2 backdrop-blur">
          <span className="text-[15px] text-pencil">Question <b className="text-ink">{view.current + 1}</b> of {TOTAL(p)}</span>
          <span className={`text-[21px] font-extrabold tabular-nums ${remaining < 10 * 60_000 ? 'text-redpen' : 'text-ink'}`} aria-label="Time left">{fmt(remaining)}</span>
          <button className="btn-primary px-3 py-1.5" onClick={() => confirm(`Submit the mock now? You've answered ${answered} of 60 MCQs.`) && submit(view)}>Submit mock</button>
        </div>

        {!isSa ? (() => {
          const id = p.mcqIds[view.current];
          const q = mcqById.get(id)!;
          const flagged = view.flags.includes(id);
          return (
            <div className="sheet space-y-5" style={tabStyle(q.chapter)}>
              <div className="flex items-center justify-between gap-3">
                <ChapterChip ch={q.chapter} />
                <button aria-pressed={flagged} className={`chip border px-3 py-1 ${flagged ? 'border-ink bg-hl text-slate-900' : 'off'}`} onClick={() => save({ ...view, flags: flagged ? view.flags.filter((x) => x !== id) : [...view.flags, id] })}>
                  {flagged ? 'Flagged for review' : 'Flag for review (F)'}
                </button>
              </div>
              <p className="max-w-[68ch] font-serif text-[19px] leading-relaxed sm:text-[21px]">{q.q}</p>
              <ol className="grid gap-2">
                {view.orders[id].map((orig, i) => (
                  <li key={orig}>
                    <button onClick={() => save({ ...view, answers: { ...view.answers, [id]: orig } })} aria-pressed={view.answers[id] === orig} className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-[15px] sm:text-base ${view.answers[id] === orig ? 'border-ink bg-brand-50' : 'border-rule hover:border-pencil/60'}`}>
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${view.answers[id] === orig ? 'border-ink bg-ink text-sheet' : 'border-rule text-pencil'}`}>{'ABCDEF'[i]}</span>
                      {q.options[orig]}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })() : (
          <ShortAnswerCard
            key={p.saIds[view.current - p.mcqIds.length]}
            sa={saById.get(p.saIds[view.current - p.mcqIds.length])!}
            initial={view.saText[view.current - p.mcqIds.length]}
            checkable={false}
            onChange={(t) => {
              const k = view.current - p.mcqIds.length;
              const saText = [...view.saText] as [string, string];
              saText[k] = t;
              save({ ...view, saText });
            }}
          />
        )}
        <div className="flex justify-between">
          <button className="btn-ghost" disabled={view.current === 0} onClick={() => go(view.current - 1)}>Previous</button>
          <button className="btn-ghost" disabled={view.current === TOTAL(p) - 1} onClick={() => go(view.current + 1)}>Next</button>
        </div>
      </div>

      <aside className="card h-fit space-y-3 lg:sticky lg:top-20">
        <p className="text-[15px] font-semibold">Scantron</p>
        <p className="-mt-2 text-[13px] text-pencil">{answered} of 60 answered, {view.flags.length} flagged</p>
        <div className="grid grid-cols-10 gap-1">
          {p.mcqIds.map((id, i) => (
            <button key={id} onClick={() => go(i)} className={`relative h-7 rounded-full border text-[10px] font-semibold tabular-nums ${i === view.current ? 'ring-2 ring-ink ring-offset-1 ring-offset-sheet' : ''} ${view.answers[id] !== undefined ? 'border-ink bg-ink text-sheet' : 'border-rule text-pencil'}`}>
              {i + 1}
              {view.flags.includes(id) && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-ink bg-hl" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[0, 1].map((k) => (
            <button key={k} onClick={() => go(p.mcqIds.length + k)} className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${view.current === p.mcqIds.length + k ? 'ring-2 ring-ink ring-offset-1 ring-offset-sheet' : ''} ${view.saText[k].trim() ? 'border-ink bg-ink text-sheet' : 'border-rule text-pencil'}`}>
              Short answer {k + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-pencil">Keys: <kbd>1</kbd>–<kbd>5</kbd> answer, <kbd>F</kbd> flag, <kbd>←</kbd> <kbd>→</kbd> move</p>
      </aside>
    </div>
  );
}

function Results({ m, onMark, onNew }: { m: MockState; onMark: (saId: string, score: number, outOf: number) => void; onNew: () => void }) {
  const p = m.paper;
  const rows = p.mcqIds.map((id) => {
    const q = mcqById.get(id)!;
    return { id, q, correct: m.answers[id] === q.answer, answered: m.answers[id] !== undefined, flagged: m.flags.includes(id), ms: m.timeMs[id] ?? 0 };
  });
  const score = rows.filter((r) => r.correct).length;
  const byChapter = CHAPTERS.map((ch) => {
    const r = rows.filter((x) => x.q.chapter === ch);
    return { ch, right: r.filter((x) => x.correct).length, total: r.length };
  });
  const byConcept = useMemo(() => {
    const m2 = new Map<string, { right: number; total: number }>();
    for (const r of rows) for (const c of r.q.concepts) {
      const v = m2.get(c) ?? { right: 0, total: 0 };
      v.total++;
      if (r.correct) v.right++;
      m2.set(c, v);
    }
    return [...m2.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.paper.id]);
  const review = byConcept.filter(([, v]) => v.right < v.total);
  const flaggedWrong = rows.filter((r) => r.flagged && !r.correct);
  const [showAll, setShowAll] = useState(false);
  const used = (m.submitted ?? m.deadline) - m.startedAt;
  const attempts = useAttempts();
  const history = attempts
    .filter((a) => a.questionId.startsWith('mock:'))
    .map((a) => ({ id: a.questionId.slice(5), ts: a.ts, pct: Number(a.meta?.score ?? 0) / (Number(a.meta?.of ?? 60) || 60) }))
    .sort((a, b) => a.ts - b.ts);
  const prev = history.filter((h) => h.id !== p.id).pop();
  const mcqMs = rows.reduce((s, r) => s + r.ms, 0);
  const avgS = Math.round(mcqMs / 1000 / rows.length);
  const slowest = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 5);
  // Leaving ~20 minutes for the two short answers gives ~100 s per MCQ.
  const PACE_S = Math.round(((MOCK_MINUTES - 20) * 60) / p.mcqIds.length);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2 py-2">
        <p className="text-[15px] text-pencil">Mock midterm results. Time used: {fmt(used)}</p>
        <p className="text-[41px] font-extrabold leading-none tracking-tight"><span className="hl">{score}</span> <span className="text-[26px] text-pencil">of 60 right</span></p>
        <p className="text-[17px] font-semibold">{Math.round((score / 60) * 100)}% on the multiple choice</p>
        {prev && (
          <p className={`text-sm font-semibold ${score / 60 >= prev.pct ? 'text-tick' : 'text-redpen'}`}>
            {score / 60 >= prev.pct ? 'Up' : 'Down'} {Math.abs(Math.round((score / 60 - prev.pct) * 100))} points from your previous mock ({Math.round(prev.pct * 100)}%)
          </p>
        )}
        {m.saMarks && Object.keys(m.saMarks).length === 2 && (
          <p className="text-sm text-pencil">Short answers self-marked: {Object.values(m.saMarks).map((x) => `${x.score}/${x.outOf}`).join(' and ')}</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-[21px] font-extrabold">By chapter</h2>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {byChapter.map((c) => (
            <div key={c.ch} className="space-y-1.5">
              <p className="flex items-baseline justify-between text-[13px]"><ChapterChip ch={c.ch} title={CHAPTER_SHORT[c.ch]} /><b className="text-[17px] tabular-nums">{c.right}/{c.total}</b></p>
              <HlBar value={c.total ? c.right / c.total : 0} label={`Ch ${c.ch} score`} />
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-[21px] font-extrabold">Pace</h2>
        <p className="text-sm">
          You averaged <b>{avgS}s</b> per MCQ. The target is about {PACE_S}s, which leaves 20 minutes for the short answers.{' '}
          {avgS <= PACE_S ? <span className="font-semibold text-tick">You're on pace.</span> : <span className="font-semibold text-redpen">Too slow: skip and flag hard ones, then come back.</span>}
        </p>
        <div>
          <p className="mb-1 text-xs font-semibold text-pencil">Slowest questions</p>
          <ul className="space-y-1 text-sm">
            {slowest.map((r) => (
              <li key={r.id} className="flex justify-between gap-3"><span className="truncate"><b>Q{p.mcqIds.indexOf(r.id) + 1}</b> {r.q.q}</span><span className={`shrink-0 tabular-nums ${r.correct ? '' : 'text-redpen'}`}>{Math.round(r.ms / 1000)}s {r.correct ? '✓' : '✗'}</span></li>
            ))}
          </ul>
        </div>
        {history.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-pencil">All mocks</p>
            <div className="flex h-16 items-end gap-1">
              {history.map((h) => (
                <div key={h.id} title={`${new Date(h.ts).toLocaleDateString()}: ${Math.round(h.pct * 100)}%`} className={`w-6 rounded-t-sm ${h.id === p.id ? 'bg-hl ring-1 ring-ink/60' : 'bg-rule'}`} style={{ height: `${Math.max(4, h.pct * 100)}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[21px] font-extrabold">Concepts to review</h2>
          {review.length > 0 && <Link to="/mistakes" className="chip px-0 font-semibold text-redpen underline decoration-redpen/40 underline-offset-4">Retry misses in the notebook →</Link>}
        </div>
        {review.length === 0 ? <p className="text-sm">Nothing missed. 🎉</p> : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {review.map(([c, v]) => (
              <li key={c}><Link to={`/lesson/${c}`} className="text-[15px] text-pencil hover:text-ink">{conceptById.get(c)?.title}</Link> <span className="text-xs text-pencil">({v.right}/{v.total})</span></li>
            ))}
          </ul>
        )}
      </div>

      {flaggedWrong.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-[21px] font-extrabold">Flagged and wrong ({flaggedWrong.length})</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{flaggedWrong.map((r) => <li key={r.id}>{r.q.q}</li>)}</ul>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-[21px] font-extrabold">Short answers — self-grade with keyword assist</h2>
        {p.saIds.map((id, k) => (
          <ShortAnswerCard
            key={id}
            sa={saById.get(id)!}
            initial={m.saText[k]}
            onMarked={(score2, outOf, text) => {
              const sa = saById.get(id)!;
              record({ questionId: id, conceptIds: sa.concepts, correct: score2 / outOf >= 0.6, confidence: null, mode: 'mock', meta: { mockId: p.id, score: score2, outOf, words: text.split(/\s+/).length } });
              onMark(id, score2, outOf);
            }}
          />
        ))}
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[21px] font-extrabold">Question review & time per question</h2>
          <button className="text-sm text-brand-600" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show wrong only' : 'Show all'}</button>
        </div>
        <ol className="space-y-2">
          {rows.map((r, i) => (!showAll && r.correct ? null : (
            <li key={r.id} className={`rounded-xl border p-3 text-sm ${r.correct ? 'border-tick/40' : 'border-redpen/40'}`}>
              <div className="flex justify-between gap-2 text-xs text-pencil">
                <span>Q{i + 1}, Ch {r.q.chapter}{r.flagged ? ', flagged' : ''}{r.answered ? '' : ', skipped'}</span>
                <span className="tabular-nums">{Math.round(r.ms / 1000)}s</span>
              </div>
              <p className="my-1 font-medium">{r.q.q}</p>
              {!r.correct && r.answered && <p className="text-redpen">Your answer: {r.q.options[m.answers[r.id]]} — {r.q.explanations[m.answers[r.id]]}</p>}
              <p className="text-tick">Correct: {r.q.options[r.q.answer]} — {r.q.explanations[r.q.answer]}</p>
              <div className="mt-1 flex flex-wrap gap-2"><Source src={r.q.src} />{r.q.concepts[0] && <Link className="chip px-0 text-ink underline decoration-hl decoration-[3px] underline-offset-4" to={`/lesson/${r.q.concepts[0]}`}>Review concept</Link>}</div>
            </li>
          )))}
        </ol>
      </div>
      <button className="btn-primary w-full" onClick={() => confirm('Start a fresh mock? These results stay in your stats.') && onNew()}>Start a new mock</button>
    </div>
  );
}
