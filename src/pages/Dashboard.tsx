import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { content, CHAPTER_SHORT, relatedIds } from '../lib/content';
import { chapterProgress, pendingMistakes } from '../lib/stats';
import { useAttempts, useSettings, daysUntil, useNow } from '../lib/hooks';
import { ProgressBar } from '../components/ProgressBar';
import { getKv, useStore } from '../lib/store';

export default function Dashboard() {
  const attempts = useAttempts();
  const settings = useSettings();
  const now = useNow(60_000);
  useStore((s) => s.kv['mock']);
  const days = daysUntil(settings.examDate, now);
  const owed = useMemo(() => pendingMistakes(attempts, relatedIds).length, [attempts]);
  const answered = attempts.filter((a) => !a.questionId.startsWith('lesson:')).length;
  const mockInProgress = !!getKv<{ submitted?: boolean }>('mock') && !getKv<{ submitted?: boolean }>('mock')?.submitted;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-brand-600 to-indigo-600 text-white dark:from-brand-700 dark:to-indigo-800">
        <div>
          <p className="text-sm opacity-90">Midterm · {new Date(settings.examDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="text-3xl font-extrabold">{days > 0 ? `${days} day${days === 1 ? '' : 's'} to go` : days === 0 ? 'Exam day — you’ve got this!' : 'Exam date passed'}</p>
          <p className="text-sm opacity-90">{answered} questions answered · {owed} mistakes queued for review</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/practice" className="btn bg-white text-brand-700 hover:bg-brand-50">⚡ Mastery practice</Link>
          <Link to="/mock" className="btn bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25">⏱️ {mockInProgress ? 'Resume mock' : 'Mock midterm'}</Link>
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
          answers (correct guesses don't count). A wrong answer after mastery knocks it back down. Chapters: {Object.entries(CHAPTER_SHORT).map(([k, v]) => `${k} ${v}`).join(' · ')}.
        </p>
      </section>
    </div>
  );
}
