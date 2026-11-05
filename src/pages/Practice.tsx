import { useMemo, useState } from 'react';
import type { ChapterId } from '../content/types';
import { CHAPTERS } from '../content/types';
import { content, mcqById, relatedIds, CHAPTER_SHORT, scopedMcqs } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { getState, record, visibleAttempts } from '../lib/store';
import { comboMultiplier, newSession, pickNext, requeueWrong, type PracticeSession } from '../lib/practice';
import { McqCard } from '../components/McqCard';
import { ShortAnswerCard } from '../components/ShortAnswerCard';
import { pendingMistakes } from '../lib/stats';
import { xpFor } from '../lib/gamify';

const PRACTICE_POOL = scopedMcqs.filter((q) => q.kind !== 'recall');
const SA_EVERY = 9;

type Item = { kind: 'mcq'; id: string; reason: string } | { kind: 'sa'; id: string };

export default function Practice() {
  const attempts = useAttempts();
  const [chapters, setChapters] = useState<ChapterId[]>([...CHAPTERS]);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [stats, setStats] = useState({ right: 0, total: 0, streak: 0, best: 0, points: 0 });
  const owedCount = useMemo(() => pendingMistakes(attempts, relatedIds).length, [attempts]);

  const next = (s: PracticeSession) => {
    if (s.count > 0 && s.count % SA_EVERY === 0 && item?.kind !== 'sa') {
      const sas = content.shortAnswers.filter((x) => s.chapters.includes(x.chapter));
      if (sas.length) {
        setSession({ ...s, count: s.count + 1 });
        setItem({ kind: 'sa', id: sas[Math.floor(Math.random() * sas.length)].id });
        return;
      }
    }
    const r = pickNext(s, visibleAttempts(getState()), PRACTICE_POOL, Date.now());
    if (!r) return setItem(null);
    setSession(r.session);
    setItem({ kind: 'mcq', id: r.qid, reason: r.reason });
  };

  const start = () => {
    const s = newSession(chapters, attempts, PRACTICE_POOL, relatedIds);
    setStats({ right: 0, total: 0, streak: 0, best: 0, points: 0 });
    next(s);
  };

  if (!session || !item) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card space-y-4">
          <h1 className="text-xl font-bold">⚡ Mastery practice (Version A)</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            An endless adaptive stream. Weak concepts come up more often, spaced repetition brings concepts back just before you'd forget them, and anything you get
            wrong returns later. {owedCount > 0 && <b>{owedCount} mistakes are queued from earlier sessions.</b>}
          </p>
          <div>
            <p className="mb-2 text-sm font-semibold">Chapters</p>
            <div className="flex flex-wrap gap-2">
              {CHAPTERS.map((c) => {
                const on = chapters.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setChapters((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                    className={`chip border px-3 py-1.5 text-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    Ch {c} · {CHAPTER_SHORT[c]}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary w-full" disabled={!chapters.length} onClick={start}>Start practice</button>
        </div>
      </div>
    );
  }

  const mult = comboMultiplier(stats.streak);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button className="text-brand-600 hover:underline" onClick={() => { setSession(null); setItem(null); }}>← End session</button>
        <div className="flex items-center gap-3 tabular-nums">
          <span>{stats.right}/{stats.total} correct</span>
          <span className={`chip ${stats.streak >= 3 ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>🔥 {stats.streak} · ×{mult}</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">+{stats.points} XP</span>
        </div>
      </div>

      {item.kind === 'mcq' ? (
        <McqCard
          key={`${item.id}-${session.count}`}
          q={mcqById.get(item.id)!}
          header={item.reason !== 'adaptive' ? <span className="chip bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Review: you missed this</span> : undefined}
          onAnswered={(r) => {
            const q = mcqById.get(item.id)!;
            const a = record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'mastery', meta: { ms: r.ms, chosen: r.chosen, mult: comboMultiplier(stats.streak) } });
            setStats((st) => {
              const streak = r.correct ? st.streak + 1 : 0;
              const gained = xpFor(a);
              return { right: st.right + (r.correct ? 1 : 0), total: st.total + 1, streak, best: Math.max(st.best, streak), points: st.points + gained };
            });
            if (!r.correct || r.confidence === 'guess') setSession((s) => (s ? requeueWrong(s, q) : s));
          }}
          onNext={() => next(session)}
        />
      ) : (
        <>
          <ShortAnswerCard
            key={`${item.id}-${session.count}`}
            sa={content.shortAnswers.find((x) => x.id === item.id)!}
            onMarked={(score, outOf, text) => {
              const sa = content.shortAnswers.find((x) => x.id === item.id)!;
              const a = record({ questionId: sa.id, conceptIds: sa.concepts, correct: score / outOf >= 0.6, confidence: null, mode: 'mastery', meta: { score, outOf, words: text.split(/\s+/).length } });
              setStats((st) => ({ ...st, points: st.points + xpFor(a) }));
            }}
          />
          <button className="btn-primary w-full" onClick={() => next(session)}>Next question →</button>
        </>
      )}
    </div>
  );
}
