import { useNavigate, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { content, conceptById } from '../lib/content';
import type { ChapterId } from '../content/types';
import { useAttempts, useSettings } from '../lib/hooks';
import { chapterProgress, masteryCounts, seenConcepts } from '../lib/stats';
import { ProgressBar } from '../components/ProgressBar';
import { ChapterTabs, TAB, tabStyle } from '../components/ui';
import { bestBoss } from './Boss';

const ROW_H = 112;
const XS = [50, 72, 80, 64, 36, 20, 28];

export default function PathPage() {
  const { ch } = useParams();
  const chapterId = (Number(ch) || content.chapters[0].id) as ChapterId;
  const chapter = content.chapters.find((c) => c.id === chapterId) ?? content.chapters[0];
  const attempts = useAttempts();
  const { masteryN } = useSettings();
  const nav = useNavigate();

  const lessonsDone = useMemo(() => new Set(attempts.filter((a) => a.questionId.startsWith('lesson:')).map((a) => a.questionId.slice(7))), [attempts]);
  const seen = useMemo(() => seenConcepts(attempts), [attempts]);
  const counts = useMemo(() => masteryCounts(attempts, masteryN), [attempts, masteryN]);
  const p = chapterProgress(chapter.conceptIds, attempts, masteryN);

  // Nodes unlock in sequence: the first node without a completed lesson is "current".
  const currentIdx = chapter.conceptIds.findIndex((id) => !lessonsDone.has(id));
  const nodes = [...chapter.conceptIds, 'boss'];
  const pts = nodes.map((_, i) => ({ x: XS[i % XS.length], y: i * ROW_H + 50 }));
  const pathD = pts.map((pt, i) => `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`).join(' ');

  return (
    <div className="space-y-6">
      <ChapterTabs active={chapter.id} to={(c) => `/learn/${c}`} />
      <div className="space-y-4">
        <div>
          <p className="text-[15px] text-pencil">Chapter {chapter.id}</p>
          <h1 className="text-[33px] font-extrabold leading-tight tracking-tight">{chapter.title}</h1>
        </div>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <ProgressBar label={`Seen ${p.seen} of ${p.total}`} value={p.coverage} tone="faint" />
          <ProgressBar label={`Mastered ${p.mastered} of ${p.total}`} value={p.mastery} tone="tick" />
        </div>
        <p className="text-[13px] text-pencil">Work down the path in order. You can still open a later concept early.</p>
      </div>

      <div className="relative mx-auto w-full max-w-md" style={{ height: nodes.length * ROW_H + 20, ...tabStyle(chapter.id) }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${nodes.length * ROW_H + 20}`} preserveAspectRatio="none" aria-hidden>
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-pencil/40" strokeLinejoin="round" strokeDasharray="1 7" strokeLinecap="round" />
        </svg>
        {nodes.map((id, i) => {
          const pt = pts[i];
          if (id === 'boss') {
            const allDone = currentIdx === -1;
            const b = bestBoss(attempts, chapter.id);
            return (
              <button
                key="boss"
                onClick={() => (allDone || b.tries || confirm('The boss is meant for after every lesson in this chapter. Fight it anyway?')) && nav(`/boss/${chapter.id}`)}
                className="group absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: `${pt.x}%`, top: pt.y }}
              >
                <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink text-3xl transition group-hover:-translate-y-0.5" style={{ background: TAB[chapter.id] }}>
                  {b.won ? '🏆' : '👑'}
                  {b.won && <span className="absolute -right-7 -top-1 rotate-[-8deg] animate-stamp rounded border-2 border-redpen bg-sheet px-1.5 text-[12px] font-extrabold text-redpen">Beaten</span>}
                </span>
                <span className="mt-1.5 block w-40 text-[15px] font-extrabold">Boss battle</span>
                <span className="block w-40 text-[12px] text-pencil">{b.won ? `Best score ${Math.round(b.best * 100)}%` : b.tries ? `Best ${Math.round(b.best * 100)}%, try again` : allDone ? 'Ready when you are' : 'After the lessons'}</span>
              </button>
            );
          }
          const c = conceptById.get(id)!;
          const mastered = (counts.get(id) ?? 0) >= masteryN;
          const done = lessonsDone.has(id);
          const isCurrent = i === currentIdx;
          const isSeen = done || seen.has(id);
          const locked = currentIdx !== -1 && i > currentIdx && !seen.has(id);
          const cls = mastered
            ? 'border-ink bg-ink text-sheet'
            : isSeen
              ? 'border-ink bg-sheet text-ink'
              : isCurrent
                ? 'border-ink bg-hl text-slate-900'
                : 'border-dashed border-pencil/50 bg-paper text-pencil';
          return (
            <button
              key={id}
              onClick={() => {
                if (locked && !confirm(`"${c.title}" comes later in the path. Open it anyway?`)) return;
                nav(`/lesson/${id}`);
              }}
              className="group absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${pt.x}%`, top: pt.y }}
              aria-label={`${c.title}${mastered ? ', mastered' : done ? ', lesson done' : isCurrent ? ', next up' : locked ? ', later in the path' : ''}`}
            >
              <span className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 text-[17px] font-extrabold transition group-hover:-translate-y-0.5 ${cls}`}>
                {mastered ? '✓' : i + 1}
                {mastered && <span className="absolute inset-[-6px] rounded-full ring-[3px] ring-hl" aria-hidden />}
                {isCurrent && !isSeen && <span className="absolute -inset-2 rounded-full border-2 border-ink/70" style={{ borderRadius: '52% 48% 55% 45%' }} aria-hidden />}
              </span>
              <span className={`mt-1.5 block w-32 text-[12px] leading-tight sm:w-40 sm:text-[13px] ${isSeen || isCurrent ? 'font-semibold text-ink' : 'text-pencil'}`}>{c.title}</span>
              <span className="mx-auto mt-1 flex w-fit gap-0.5" aria-label={`${Math.min(counts.get(id) ?? 0, masteryN)} of ${masteryN} correct towards mastery`}>
                {Array.from({ length: masteryN }, (_, k) => (
                  <span key={k} className={`h-1.5 w-3 rounded-sm ${k < (counts.get(id) ?? 0) ? 'bg-tick' : 'bg-rule'}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
