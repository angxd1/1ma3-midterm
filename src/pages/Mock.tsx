import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { content, mcqById, saById, conceptById, relatedIds, canShuffle, CHAPTER_SHORT } from '../lib/content';
import { composeMock, MOCK_MINUTES, type MockPaper } from '../lib/mock';
import { record, setKv, useStore, getState, visibleAttempts } from '../lib/store';
import { useAttempts, useNow } from '../lib/hooks';
import { ShortAnswerCard } from '../components/ShortAnswerCard';
import { Source } from '../components/ConceptPanel';
import { CHAPTERS } from '../content/types';

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
        <div className="card space-y-3">
          <h1 className="text-xl font-bold">⏱️ Timed mock midterm (Version B)</h1>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
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
        <div className="sticky top-14 z-10 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-slate-800">
          <span className="text-sm">Q {view.current + 1} / {TOTAL(p)}</span>
          <span className={`font-mono text-lg font-bold tabular-nums ${remaining < 10 * 60_000 ? 'text-rose-400' : ''}`}>{fmt(remaining)}</span>
          <button className="btn bg-white px-3 py-1.5 text-slate-900" onClick={() => confirm(`Submit now? ${answered}/60 MCQs answered.`) && submit(view)}>Submit</button>
        </div>

        {!isSa ? (() => {
          const id = p.mcqIds[view.current];
          const q = mcqById.get(id)!;
          const flagged = view.flags.includes(id);
          return (
            <div className="card space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Ch {q.chapter}</span>
                <button className={`chip border px-3 py-1 ${flagged ? 'border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'border-slate-300 dark:border-slate-700'}`} onClick={() => save({ ...view, flags: flagged ? view.flags.filter((x) => x !== id) : [...view.flags, id] })}>
                  🚩 {flagged ? 'Flagged' : 'Flag for review (F)'}
                </button>
              </div>
              <p className="font-medium leading-relaxed sm:text-lg">{q.q}</p>
              <div className="grid gap-2">
                {view.orders[id].map((orig, i) => (
                  <button key={orig} onClick={() => save({ ...view, answers: { ...view.answers, [id]: orig } })} className={`flex gap-3 rounded-xl border-2 p-3 text-left text-sm sm:text-base ${view.answers[id] === orig ? 'border-brand-500 bg-brand-50 dark:bg-brand-700/20' : 'border-slate-200 hover:border-brand-400 dark:border-slate-700'}`}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold dark:bg-slate-800">{'ABCDEF'[i]}</span>
                    {q.options[orig]}
                  </button>
                ))}
              </div>
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
          <button className="btn-ghost" disabled={view.current === 0} onClick={() => go(view.current - 1)}>← Prev</button>
          <button className="btn-ghost" disabled={view.current === TOTAL(p) - 1} onClick={() => go(view.current + 1)}>Next →</button>
        </div>
      </div>

      <aside className="card h-fit space-y-3 lg:sticky lg:top-20">
        <p className="text-sm font-semibold">Scantron · {answered}/60 answered · {view.flags.length} flagged</p>
        <div className="grid grid-cols-10 gap-1">
          {p.mcqIds.map((id, i) => (
            <button key={id} onClick={() => go(i)} className={`relative h-7 rounded text-[10px] font-semibold ${i === view.current ? 'ring-2 ring-brand-500' : ''} ${view.answers[id] !== undefined ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
              {i + 1}
              {view.flags.includes(id) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[0, 1].map((k) => (
            <button key={k} onClick={() => go(p.mcqIds.length + k)} className={`rounded px-2 py-1.5 text-xs font-semibold ${view.current === p.mcqIds.length + k ? 'ring-2 ring-brand-500' : ''} ${view.saText[k].trim() ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
              Short answer {k + 1}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">Keys: 1–5 answer · F flag · ←/→ move</p>
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
      <div className="card text-center">
        <p className="text-sm text-slate-500">Mock midterm results · time used {fmt(used)}</p>
        <p className="text-5xl font-extrabold">{score}<span className="text-2xl text-slate-400">/60</span></p>
        <p className="font-semibold">{Math.round((score / 60) * 100)}% on multiple choice</p>
        {prev && (
          <p className={`text-sm font-semibold ${score / 60 >= prev.pct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {score / 60 >= prev.pct ? '▲' : '▼'} {Math.abs(Math.round((score / 60 - prev.pct) * 100))} points vs your previous mock ({Math.round(prev.pct * 100)}%)
          </p>
        )}
        {m.saMarks && Object.keys(m.saMarks).length === 2 && (
          <p className="text-sm text-slate-500">Short answers self-marked: {Object.values(m.saMarks).map((x) => `${x.score}/${x.outOf}`).join(' and ')}</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-bold">By chapter</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {byChapter.map((c) => (
            <div key={c.ch} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Ch {c.ch} · {CHAPTER_SHORT[c.ch]}</p>
              <p className="text-lg font-bold tabular-nums">{c.right}/{c.total}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">Pace</h2>
        <p className="text-sm">
          Average <b>{avgS}s</b> per MCQ (target ≈ {PACE_S}s to leave 20 min for the short answers) ·{' '}
          {avgS <= PACE_S ? <span className="text-emerald-700 dark:text-emerald-300">on pace</span> : <span className="text-rose-700 dark:text-rose-300">too slow — skip and flag, come back later</span>}
        </p>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Slowest questions</p>
          <ul className="space-y-1 text-sm">
            {slowest.map((r) => (
              <li key={r.id} className="flex justify-between gap-3"><span className="truncate">Q{p.mcqIds.indexOf(r.id) + 1} · {r.q.q}</span><span className={`shrink-0 tabular-nums ${r.correct ? '' : 'text-rose-600 dark:text-rose-400'}`}>{Math.round(r.ms / 1000)}s {r.correct ? '✓' : '✗'}</span></li>
            ))}
          </ul>
        </div>
        {history.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">All mocks</p>
            <div className="flex h-16 items-end gap-1">
              {history.map((h) => (
                <div key={h.id} title={`${new Date(h.ts).toLocaleDateString()} · ${Math.round(h.pct * 100)}%`} className={`w-6 rounded-t ${h.id === p.id ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`} style={{ height: `${Math.max(4, h.pct * 100)}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Concepts to review</h2>
          {review.length > 0 && <Link to="/mistakes" className="chip bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Retry misses in the notebook →</Link>}
        </div>
        {review.length === 0 ? <p className="text-sm">Nothing missed. 🎉</p> : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {review.map(([c, v]) => (
              <li key={c}><Link to={`/lesson/${c}`} className="text-sm text-brand-600 hover:underline">{conceptById.get(c)?.title}</Link> <span className="text-xs text-slate-500">({v.right}/{v.total})</span></li>
            ))}
          </ul>
        )}
      </div>

      {flaggedWrong.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-bold">Flagged and wrong ({flaggedWrong.length})</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{flaggedWrong.map((r) => <li key={r.id}>{r.q.q}</li>)}</ul>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-bold">Short answers — self-grade with keyword assist</h2>
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
          <h2 className="font-bold">Question review & time per question</h2>
          <button className="text-sm text-brand-600" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show wrong only' : 'Show all'}</button>
        </div>
        <ol className="space-y-2">
          {rows.map((r, i) => (!showAll && r.correct ? null : (
            <li key={r.id} className={`rounded-xl border p-3 text-sm ${r.correct ? 'border-emerald-200 dark:border-emerald-900' : 'border-rose-200 dark:border-rose-900'}`}>
              <div className="flex justify-between gap-2 text-xs text-slate-500">
                <span>Q{i + 1} · Ch {r.q.chapter} {r.flagged && '· 🚩'} {r.answered ? '' : '· skipped'}</span>
                <span className="tabular-nums">{Math.round(r.ms / 1000)}s</span>
              </div>
              <p className="my-1 font-medium">{r.q.q}</p>
              {!r.correct && r.answered && <p className="text-rose-700 dark:text-rose-300">Your answer: {r.q.options[m.answers[r.id]]} — {r.q.explanations[m.answers[r.id]]}</p>}
              <p className="text-emerald-700 dark:text-emerald-300">Correct: {r.q.options[r.q.answer]} — {r.q.explanations[r.q.answer]}</p>
              <div className="mt-1 flex flex-wrap gap-2"><Source src={r.q.src} />{r.q.concepts[0] && <Link className="chip bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100" to={`/lesson/${r.q.concepts[0]}`}>Review concept</Link>}</div>
            </li>
          )))}
        </ol>
      </div>
      <button className="btn-primary w-full" onClick={() => confirm('Start a fresh mock? These results stay in your stats.') && onNew()}>Start a new mock</button>
    </div>
  );
}
