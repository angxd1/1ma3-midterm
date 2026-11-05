import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { content, conceptById, mcqById, relatedIds, CHAPTER_SHORT } from '../lib/content';
import { useAttempts, useNow, useProgress, useSettings } from '../lib/hooks';
import { buildPlan, taskComplete, type PlanDay, type PlanTask } from '../lib/plan';
import { readiness } from '../lib/readiness';
import { dayKey } from '../lib/gamify';
import type { ChapterId } from '../content/types';

const CONCEPT_ORDER = content.chapters.flatMap((c) => c.conceptIds);

export function usePlan(): PlanDay[] {
  const attempts = useAttempts();
  const { masteryN, examDate } = useSettings();
  const now = useNow(60_000);
  const today = dayKey(now);
  return useMemo(
    () => buildPlan({ attempts, conceptOrder: CONCEPT_ORDER, masteryN, examDate, now, related: relatedIds, reviewable: (id) => mcqById.has(id) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempts, masteryN, examDate, today],
  );
}

export function useReadiness() {
  const attempts = useAttempts();
  const now = useNow(60_000);
  const hour = Math.floor(now / 3_600_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readiness(attempts, content.chapters, now), [attempts, hour]);
}

function Bar({ value, cls = 'bg-brand-500' }: { value: number; cls?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`h-full rounded-full ${cls} transition-all`} style={{ width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%` }} />
    </div>
  );
}

/** Level, XP bar, streak and today's XP goal. */
export function LevelStrip() {
  const { level, streak, todayXp, dailyGoal } = useProgress();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Link to="/progress" className="card col-span-2 space-y-1.5 sm:col-span-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">Lv {level.level} · {level.title}</p>
          <p className="text-xs tabular-nums text-slate-500">{level.into}/{level.span} XP</p>
        </div>
        <Bar value={level.progress} cls="bg-amber-500" />
      </Link>
      <div className="card text-center">
        <p className={`text-2xl ${streak.studiedToday ? '' : 'grayscale'}`}>🔥</p>
        <p className="text-lg font-extrabold tabular-nums">{streak.current}</p>
        <p className="text-[11px] text-slate-500">{streak.current === 1 ? 'day' : 'days'} streak{!streak.studiedToday && streak.current > 0 ? ' · study today to keep it' : ''}</p>
      </div>
      <div className="card space-y-1 text-center">
        <p className="text-2xl">{todayXp >= dailyGoal ? '🏆' : '🎯'}</p>
        <p className="text-lg font-extrabold tabular-nums">{todayXp}<span className="text-xs font-medium text-slate-500">/{dailyGoal}</span></p>
        <p className="text-[11px] text-slate-500">XP today</p>
        <Bar value={todayXp / dailyGoal} cls="bg-emerald-500" />
      </div>
    </div>
  );
}

export function ReadinessCard({ detailed = false }: { detailed?: boolean }) {
  const r = useReadiness();
  const pct = Math.round(r.pct * 100);
  const tone = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Readiness</h2>
          <p className="text-xs text-slate-500">Projected MCQ score if the midterm were now</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-extrabold tabular-nums ${tone}`}>{pct}%</p>
          <p className="text-xs tabular-nums text-slate-500">≈ {Math.round(r.projected)}/{r.of} MCQs</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        {r.chapters.map((c) => (
          <Link key={c.id} to={`/learn/${c.id}`} className="space-y-1" title={`${CHAPTER_SHORT[c.id as ChapterId]}: ≈${c.projected.toFixed(1)}/${c.of}`}>
            <div className="flex justify-between text-[11px]"><span className="font-semibold">Ch {c.id}</span><span className="tabular-nums text-slate-500">{c.projected.toFixed(1)}</span></div>
            <Bar value={c.projected / c.of} cls={c.projected / c.of >= 0.8 ? 'bg-emerald-500' : c.projected / c.of >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'} />
          </Link>
        ))}
      </div>
      {r.evidence < 0.3 && <p className="text-xs text-slate-500">Rough estimate: only {Math.round(r.evidence * 100)}% of concepts have 3+ answers yet. Unseen concepts count as a 25% guess.</p>}
      {detailed && (
        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          {r.weakest.length > 0 && (
            <>
              <p className="font-semibold">Weakest concepts you've tried</p>
              <ul className="space-y-1">
                {r.weakest.map((w) => (
                  <li key={w.conceptId} className="flex items-center justify-between gap-2">
                    <Link className="text-brand-600 hover:underline" to={`/lesson/${w.conceptId}`}>{conceptById.get(w.conceptId)?.title}</Link>
                    <span className="tabular-nums text-slate-500">{Math.round(w.p * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-xs text-slate-500">
            How it's estimated: for each concept, your last 8 answers (newest count most; correct guesses count half) give a knowledge score, which fades once the concept is past its
            spaced-repetition review date. Chance of getting a question right = 25% + 75% × knowledge. Each chapter is ≈10 of the 60 MCQs. Short answers aren't included.
          </p>
        </div>
      )}
    </section>
  );
}

function dayLabel(d: PlanDay) {
  if (d.index === 0) return 'Today';
  if (d.index === 1) return 'Tomorrow';
  const [y, m, dd] = d.date.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function TaskRow({ t, today }: { t: PlanTask; today: boolean }) {
  const done = today && taskComplete(t);
  let body: React.ReactNode;
  let to: string | undefined;
  let progress: number | undefined;
  switch (t.kind) {
    case 'learn': {
      const chs = [...new Set(t.conceptIds.map((c) => conceptById.get(c)?.chapter))].filter(Boolean);
      body = <>Learn <b>{t.conceptIds.length}</b> new concept{t.conceptIds.length === 1 ? '' : 's'} <span className="text-slate-500">(Ch {chs.join(', ')})</span></>;
      to = `/learn/${conceptById.get(t.conceptIds[t.done] ?? t.conceptIds[0])?.chapter ?? ''}`;
      progress = today ? t.done / t.conceptIds.length : undefined;
      break;
    }
    case 'practice':
      body = <>Answer <b>{t.target}</b> practice questions</>;
      to = '/practice';
      progress = today ? t.done / t.target : undefined;
      break;
    case 'review':
      body = t.target ? <>Clear <b>{t.target}</b> owed mistake{t.target === 1 ? '' : 's'}</> : <>Clear any new mistakes in the notebook</>;
      to = '/mistakes';
      progress = today && t.target ? t.done / t.target : undefined;
      break;
    case 'mock':
      body = <>Sit a full <b>mock midterm</b> (60 MCQ + 2 SA, 2 h)</>;
      to = '/mock';
      break;
    case 'final':
      body = <>Light day: read your last-night sheet (notebook, confusable pairs, Ch 4 short answers), then sleep early</>;
      to = '/last-night';
      break;
  }
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{done ? '✓' : ''}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`text-sm ${done ? 'text-slate-400 line-through' : ''}`}>{body}{today && progress !== undefined && !done && <span className="ml-1 text-xs tabular-nums text-slate-500">({Math.round(progress * 100)}%)</span>}</p>
        {today && progress !== undefined && !done && <Bar value={progress} />}
      </div>
      {today && to && !done && <Link to={to} className="chip shrink-0 bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">Go</Link>}
    </li>
  );
}

export function PlanCard({ all = false }: { all?: boolean }) {
  const plan = usePlan();
  if (!plan.length) {
    return (
      <section className="card space-y-1">
        <h2 className="font-bold">Study plan</h2>
        <p className="text-sm text-slate-500">It's exam day (or the date has passed). Warm up with a few “sure” questions, then go get it. Change the date in Settings if needed.</p>
      </section>
    );
  }
  const days = all ? plan : plan.slice(0, 1);
  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{all ? `Study plan · ${plan.length} day${plan.length === 1 ? '' : 's'} left` : "Today's plan"}</h2>
        {!all && <Link to="/progress" className="text-xs text-brand-600 hover:underline">Full plan →</Link>}
      </div>
      {days.map((d) => (
        <div key={d.date} className="space-y-2">
          {all && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(d)}</p>}
          <ul className="space-y-2.5">
            {d.tasks.map((t, i) => <TaskRow key={i} t={t} today={d.index === 0} />)}
          </ul>
        </div>
      ))}
      {all && <p className="text-xs text-slate-500">Re-planned every morning from what's left: lessons go in the first days, the last day is review only, and the mock sits two days before the exam so there's time to fix what it shows.</p>}
    </section>
  );
}
