import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { content, CHAPTER_SHORT, owedMcqs } from '../lib/content';
import { chapterProgress } from '../lib/stats';
import { useAttempts, useSettings, daysUntil, useNow } from '../lib/hooks';
import { ProgressBar } from '../components/ProgressBar';
import { getKv, useStore } from '../lib/store';
import { LevelStrip, PlanCard, ReadinessCard } from '../components/ProgressWidgets';
import { isQuestion } from '../lib/gamify';

export default function Dashboard() {
  const attempts = useAttempts();
  const settings = useSettings();
  const now = useNow(60_000);
  useStore((s) => s.kv['mock']);
  const days = daysUntil(settings.examDate, now);
  const owed = useMemo(() => owedMcqs(attempts).length, [attempts]);
  const answered = attempts.filter(isQuestion).length;
  const mockInProgress = !!getKv<{ submitted?: boolean }>('mock') && !getKv<{ submitted?: boolean }>('mock')?.submitted;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-brand-600 to-indigo-600 text-white dark:from-brand-700 dark:to-indigo-800">
        <div>
          <p className="text-sm opacity-90">Midterm · {new Date(settings.examDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="text-3xl font-extrabold">{days > 0 ? `${days} day${days === 1 ? '' : 's'} to go` : days === 0 ? 'Exam day — you’ve got this!' : 'Exam date passed'}</p>
          <p className="text-sm opacity-90">{answered} questions answered · <Link to="/mistakes" className="underline decoration-white/50 underline-offset-2">{owed} mistakes queued for review</Link></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/practice" className="btn bg-white text-brand-700 hover:bg-brand-50">⚡ Mastery practice</Link>
          <Link to="/mock" className="btn bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25">⏱️ {mockInProgress ? 'Resume mock' : 'Mock midterm'}</Link>
        </div>
      </section>

      <LevelStrip />
      <div className="grid gap-5 lg:grid-cols-2">
        <PlanCard />
        <ReadinessCard />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Drills</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['/lightning', '⚡', 'Lightning round', '60-second speed run'],
            ['/flashcards', '🃏', 'Flashcards', 'Key terms, spaced'],
            ['/confusables', '🔀', 'Confusable pairs', 'Side-by-side + drill'],
            [`/learn/${content.chapters[0].id}`, '👑', 'Boss battles', 'End of each chapter path'],
            ['/last-night', '🌙', 'Last-night sheet', 'Printable PDF review'],
          ].map(([to, icon, title, sub]) => (
            <Link key={to} to={to} className="card space-y-1 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-2xl">{icon}</p>
              <p className="text-sm font-bold">{title}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Chapters</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {content.chapters.map((ch) => {
            const p = chapterProgress(ch.conceptIds, attempts, settings.masteryN);
            return (
              <Link key={ch.id} to={`/learn/${ch.id}`} className="card block space-y-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Chapter {ch.id}</p>
                  <p className="font-bold">{ch.title}</p>
                  <p className="text-xs text-slate-500">{ch.conceptIds.length} concepts{ch.id === 4 ? ' · short answer guaranteed' : ch.id === 7 ? ' · MCQ only' : ''}</p>
                </div>
                <ProgressBar label={`Coverage (${p.seen}/${p.total} seen)`} value={p.coverage} />
                <ProgressBar label={`Mastery (${p.mastered}/${p.total})`} value={p.mastery} color="bg-emerald-500" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card text-sm text-slate-600 dark:text-slate-300">
        <p>
          <b>How progress works:</b> a concept is <i>seen</i> once you finish its lesson or answer any question on it. It's <i>mastered</i> after {settings.masteryN} correct
          answers (correct guesses don't count). A wrong answer after mastery knocks it back down. Press <kbd>?</kbd> for keyboard shortcuts. Chapters: {Object.entries(CHAPTER_SHORT).map(([k, v]) => `${k} ${v}`).join(' · ')}.
        </p>
      </section>
    </div>
  );
}
