import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { content, conceptById, CHAPTER_SHORT } from '../lib/content';
import type { ChapterId } from '../content/types';
import { useAttempts, useSettings } from '../lib/hooks';
import { chapterProgress, masteryCounts, seenConcepts } from '../lib/stats';
import { ProgressBar } from '../components/ProgressBar';

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
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {content.chapters.map((c) => (
          <Link key={c.id} to={`/learn/${c.id}`} ref={c.id === chapter.id ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${c.id === chapter.id ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'}`}>
            Ch {c.id} · {CHAPTER_SHORT[c.id]}
          </Link>
        ))}
      </div>
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">Chapter {chapter.id}: {chapter.title}</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressBar label={`Coverage (${p.seen}/${p.total})`} value={p.coverage} />
          <ProgressBar label={`Mastery (${p.mastered}/${p.total})`} value={p.mastery} color="bg-emerald-500" />
        </div>
        <p className="text-xs text-slate-500">Nodes unlock in order, but you can tap a locked node to jump ahead.</p>
      </div>

      <div className="relative mx-auto w-full max-w-md" style={{ height: nodes.length * ROW_H + 20 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${nodes.length * ROW_H + 20}`} preserveAspectRatio="none" aria-hidden>
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="6" vectorEffect="non-scaling-stroke" className="text-slate-200 dark:text-slate-800" strokeLinejoin="round" strokeDasharray="2 10" strokeLinecap="round" />
        </svg>
        {nodes.map((id, i) => {
          const pt = pts[i];
          if (id === 'boss') {
            const allDone = currentIdx === -1;
            return (
              <div key="boss" className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${pt.x}%`, top: pt.y }}>
                <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl shadow-lg ${allDone ? 'bg-gradient-to-br from-amber-400 to-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}>👑</div>
                <p className="mt-1 w-36 text-xs font-semibold">Boss battle<br /><span className="font-normal text-slate-500">coming in Phase 3</span></p>
              </div>
            );
          }
          const c = conceptById.get(id)!;
          const mastered = (counts.get(id) ?? 0) >= masteryN;
          const done = lessonsDone.has(id);
          const isCurrent = i === currentIdx;
          const locked = currentIdx !== -1 && i > currentIdx && !seen.has(id);
          const cls = mastered
            ? 'bg-emerald-500 text-white ring-emerald-200 dark:ring-emerald-900'
            : done || seen.has(id)
              ? 'bg-brand-500 text-white ring-brand-200 dark:ring-brand-900'
              : isCurrent
                ? 'bg-white text-brand-700 ring-brand-500 animate-pulse dark:bg-slate-900'
                : 'bg-slate-200 text-slate-500 ring-slate-100 dark:bg-slate-800 dark:ring-slate-900';
          return (
            <button
              key={id}
              onClick={() => {
                if (locked && !confirm(`"${c.title}" is locked. Jump ahead anyway?`)) return;
                nav(`/lesson/${id}`);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${pt.x}%`, top: pt.y }}
              aria-label={`${c.title}${mastered ? ' (mastered)' : done ? ' (lesson done)' : locked ? ' (locked)' : ''}`}
            >
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold shadow ring-4 transition hover:scale-105 ${cls}`}>
                {mastered ? '★' : done ? '✓' : locked ? '🔒' : i + 1}
              </div>
              <p className="mt-1 w-32 text-[11px] font-medium leading-tight sm:w-40 sm:text-xs">{c.title}</p>
              <div className="mx-auto mt-0.5 flex w-fit gap-0.5">
                {Array.from({ length: masteryN }, (_, k) => (
                  <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < (counts.get(id) ?? 0) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
