import { useMemo, useState } from 'react';
import type { ChapterId } from '../content/types';
import { CHAPTERS } from '../content/types';
import { content, mcqById, relatedIds, CHAPTER_SHORT, scopedMcqs, owedMcqs } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { getState, record, visibleAttempts } from '../lib/store';
import { comboMultiplier, newSession, pickNext, requeueWrong, type PracticeSession } from '../lib/practice';
import { McqCard } from '../components/McqCard';
import { TAB } from '../components/ui';
import { ShortAnswerCard } from '../components/ShortAnswerCard';
import { xpFor } from '../lib/gamify';

const PRACTICE_POOL = scopedMcqs.filter((q) => q.kind !== 'recall');
const PRACTICE_IDS = new Set(PRACTICE_POOL.map((q) => q.id));
const SA_EVERY = 9;

type Item = { kind: 'mcq'; id: string; reason: string } | { kind: 'sa'; id: string };

export default function Practice() {
  const attempts = useAttempts();
  const [chapters, setChapters] = useState<ChapterId[]>([...CHAPTERS]);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [stats, setStats] = useState({ right: 0, total: 0, streak: 0, best: 0, points: 0 });
  const owedCount = useMemo(() => owedMcqs(attempts).filter((id) => PRACTICE_IDS.has(id)).length, [attempts]);

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
        <div className="card space-y-5 sm:p-6">
          <h1 className="text-[26px] font-extrabold leading-tight">Mastery practice</h1>
          <p className="max-w-[60ch] text-[15px] text-ink/85">
            Questions keep coming until you stop. Weak concepts come up more often, spaced repetition brings concepts back just before you'd forget them, and anything you
            get wrong comes back later. {owedCount > 0 && <><span className="hl font-semibold">{owedCount} owed mistakes</span> from earlier sessions are mixed in.</>}
          </p>
          <div>
            <p className="mb-2 text-[15px] font-semibold">Chapters</p>
            <div className="flex flex-wrap gap-2">
              {CHAPTERS.map((c) => {
                const on = chapters.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setChapters((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                    className={`chip border px-3 py-1.5 text-sm ${on ? 'on' : 'off'}`}
                  >
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TAB[c] }} />Ch {c} {CHAPTER_SHORT[c]}
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <button className="text-pencil hover:text-ink" onClick={() => { setSession(null); setItem(null); }}>End session</button>
        <div className="flex items-center gap-4 tabular-nums">
          <span className="text-pencil"><b className="text-ink">{stats.right}</b> of {stats.total} right</span>
          <span className={stats.streak >= 3 ? 'hl font-semibold' : 'text-pencil'} title="Combo multiplier: every 3 in a row adds ×0.5">{stats.streak} in a row{mult > 1 ? `, ×${mult} XP` : ''}</span>
          <span key={stats.points} className="animate-slidein font-extrabold">+{stats.points} XP</span>
        </div>
      </div>

      {item.kind === 'mcq' ? (
        <McqCard
          key={`${item.id}-${session.count}`}
          q={mcqById.get(item.id)!}
          header={item.reason !== 'adaptive' ? <span className="text-xs font-semibold text-redpen">You missed this before</span> : undefined}
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
          <button className="btn-primary w-full" onClick={() => next(session)}>Next question</button>
        </>
      )}
    </div>
  );
}
