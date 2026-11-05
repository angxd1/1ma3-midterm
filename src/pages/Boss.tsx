import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ChapterId } from '../content/types';
import { content, mcqById, CHAPTER_SHORT } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { getState, record, visibleAttempts } from '../lib/store';
import { BOSS_HEARTS, BOSS_PASS, bossLength, bossOutcome, composeBoss, type BossPaper } from '../lib/drills';
import { McqCard } from '../components/McqCard';
import { FillCard, MatchingCard } from '../components/Drills';
import { HlBar, tabStyle } from '../components/ui';

type Step = { kind: 'mcq'; id: string } | { kind: 'match'; id: string } | { kind: 'fill'; id: string };

function steps(p: BossPaper): Step[] {
  const s: Step[] = p.mcqIds.map((id) => ({ kind: 'mcq', id }));
  // Interleave: a fill-in after Q4 and Q9, the matching set as the finale.
  p.fillIds.forEach((id, i) => s.splice(Math.min(s.length, 4 + i * 5), 0, { kind: 'fill', id }));
  if (p.matchingId) s.push({ kind: 'match', id: p.matchingId });
  return s;
}

export function bestBoss(attempts: ReturnType<typeof useAttempts>, ch: number) {
  const runs = attempts.filter((a) => a.questionId === `boss:${ch}`);
  return { won: runs.some((a) => a.meta?.won), best: Math.max(0, ...runs.map((a) => Number(a.meta?.pct ?? 0))), tries: runs.length };
}

/**
 * Chapter boss: 15 mixed challenges (MCQ, fill-in, matching), 3 hearts.
 * Each miss costs a heart; win with ≥80% and a heart to spare.
 */
export default function Boss() {
  const { ch } = useParams();
  const chapter = (Number(ch) || 3) as ChapterId;
  const meta = content.chapters.find((c) => c.id === chapter);
  const attempts = useAttempts();
  const best = useMemo(() => bestBoss(attempts, chapter), [attempts, chapter]);
  const [paper, setPaper] = useState<BossPaper | null>(null);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0, wrong: 0 });
  const [over, setOver] = useState<null | { won: boolean; pct: number; hearts: number }>(null);

  if (!meta) return <p>Unknown chapter.</p>;
  const plan = paper ? steps(paper) : [];
  const step = plan[pos];

  const start = () => {
    setPaper(composeBoss(content, chapter, visibleAttempts(getState()), Math.random));
    setPos(0);
    setScore({ right: 0, total: 0, wrong: 0 });
    setOver(null);
  };

  const finish = (s: typeof score) => {
    const total = paper ? bossLength(paper) : s.total;
    const o = bossOutcome(s.right, total, s.wrong);
    record({ questionId: `boss:${chapter}`, conceptIds: [], correct: true, confidence: null, mode: 'boss', meta: { won: o.won, pct: o.pct, score: s.right, of: total, hearts: o.hearts } });
    setOver(o);
  };

  const answered = (ok: boolean, weight = 1) => {
    const s = { right: score.right + (ok ? weight : 0), total: score.total + weight, wrong: score.wrong + (ok ? 0 : 1) };
    setScore(s);
    return s;
  };
  const advance = (s = score) => {
    if (s.wrong >= BOSS_HEARTS || pos + 1 >= plan.length) finish(s);
    else setPos((p) => p + 1);
  };

  if (!paper || over) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link to={`/learn/${chapter}`} className="text-[15px] text-pencil hover:text-ink">Ch {chapter} path</Link>
        <div className="sheet space-y-4 text-center" style={tabStyle(chapter)}>
          <p className="text-6xl">{over ? (over.won ? '🏆' : '💀') : '👑'}</p>
          {over ? (
            <>
              <h1 className="text-2xl font-extrabold">{over.won ? 'Boss defeated!' : over.hearts === 0 ? 'Out of hearts' : 'The boss survives'}</h1>
              <p className="text-ink/85">
                {score.right}/{paper ? bossLength(paper) : score.total} correct ({Math.round(over.pct * 100)}%) {'❤️'.repeat(over.hearts)}{'🖤'.repeat(BOSS_HEARTS - over.hearts)}
              </p>
              {!over.won && <p className="text-sm text-pencil">You need {Math.round(BOSS_PASS * 100)}% with at least one heart left. Misses are in your mistake notebook.</p>}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold">Ch {chapter} boss: {CHAPTER_SHORT[chapter]}</h1>
              <p className="text-sm text-ink/85">
                15 challenges from across the chapter: 12 MCQs aimed at your weakest concepts, 2 fill-in-the-blanks and a matching set to finish. You have {BOSS_HEARTS} hearts; every miss costs one. Win with {Math.round(BOSS_PASS * 100)}%+ and a heart left.
              </p>
              {best.tries > 0 && <p className="text-sm">{best.won ? 'Already beaten' : 'Not beaten yet'}. Best score {Math.round(best.best * 100)}% over {best.tries} attempt{best.tries === 1 ? '' : 's'}.</p>}
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-primary" onClick={start}>{over ? 'Fight again' : 'Start battle'}</button>
            {over && <Link className="btn-ghost" to="/mistakes">Mistake notebook</Link>}
          </div>
        </div>
      </div>
    );
  }

  const hearts = BOSS_HEARTS - score.wrong;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button className="text-[15px] text-pencil hover:text-ink" onClick={() => confirm('Retreat? This attempt won’t count.') && setPaper(null)}>Retreat</button>
        <span className="text-lg" aria-label={`${hearts} hearts left`}>{'❤️'.repeat(Math.max(0, hearts))}{'🖤'.repeat(BOSS_HEARTS - Math.max(0, hearts))}</span>
        <span className="tabular-nums">{pos + 1}/{plan.length}</span>
      </div>
      <HlBar value={pos / plan.length} label="Boss battle progress" />
      {step.kind === 'mcq' && (
        <McqCard
          key={step.id}
          q={mcqById.get(step.id)!}
          askConfidence={false}
          header={<span className="text-xs font-semibold text-ink">Boss battle</span>}
          onAnswered={(r) => {
            const q = mcqById.get(step.id)!;
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: null, mode: 'boss', meta: { ms: r.ms, chosen: r.chosen } });
            answered(r.correct);
          }}
          onNext={() => advance()}
        />
      )}
      {step.kind === 'fill' && (
        <FillCard
          key={step.id}
          f={content.fillBlanks.find((f) => f.id === step.id)!}
          onDone={(ok) => {
            const f = content.fillBlanks.find((x) => x.id === step.id)!;
            record({ questionId: f.id, conceptIds: f.concepts, correct: ok, confidence: null, mode: 'boss' });
            answered(ok);
          }}
          onNext={() => advance()}
        />
      )}
      {step.kind === 'match' && (
        <MatchingCard
          key={step.id}
          m={content.matching.find((m) => m.id === step.id)!}
          onDone={(right, total) => {
            const m = content.matching.find((x) => x.id === step.id)!;
            const ok = right === total;
            record({ questionId: m.id, conceptIds: m.concepts, correct: ok, confidence: null, mode: 'boss', meta: { score: right, of: total } });
            answered(ok);
          }}
          onNext={() => advance()}
        />
      )}
    </div>
  );
}
