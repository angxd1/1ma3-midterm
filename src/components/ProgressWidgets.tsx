import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { content, conceptById, mcqById, relatedIds, CHAPTER_SHORT } from '../lib/content';
import { chapterProgress } from '../lib/stats';
import { HlBar, TAB } from './ui';
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

/** Level, XP to next level, streak and today's XP goal, as one quiet line of stats. */
export function LevelLine() {
  const { level, streak, todayXp, dailyGoal } = useProgress();
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
      <Link to="/progress" className="space-y-1.5" title="Levels, badges and the full plan">
        <p className="flex items-baseline justify-between gap-2 text-[15px]">
          <span><b>Level {level.level}</b> <span className="text-pencil">{level.title}</span></span>
          <span className="text-[13px] tabular-nums text-pencil">{level.into} / {level.span} XP</span>
        </p>
        <HlBar value={level.progress} label="XP to next level" />
      </Link>
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-2 text-[15px]">
          <span><b className="tabular-nums">{streak.current}</b>-day streak</span>
          <span className="text-[13px] text-pencil">{streak.studiedToday ? 'Studied today' : streak.current > 0 ? 'Study today to keep it' : 'Start one today'}</span>
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-sm ${i < Math.min(streak.current, 7) ? 'bg-hl' : 'bg-rule'}`} />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-2 text-[15px]">
          <span><b className="tabular-nums">{todayXp}</b> of {dailyGoal} XP today</span>
          <span className="text-[13px] text-pencil">{todayXp >= dailyGoal ? 'Goal met' : `${dailyGoal - todayXp} to go`}</span>
        </p>
        <HlBar value={todayXp / dailyGoal} tone={todayXp >= dailyGoal ? 'tick' : 'hl'} label="Daily XP goal" />
      </div>
    </div>
  );
}

/** Readiness as one thick highlighter bar: projected MCQs out of 60. */
export function ReadinessBar() {
  const r = useReadiness();
  return (
    <Link to="/progress" className="block space-y-2" title="How readiness is estimated">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
        <span><b>Readiness</b> <span className="text-pencil">if the midterm were today</span></span>
        <span><b className="text-[21px] tabular-nums">{Math.round(r.projected)}</b> <span className="text-pencil">of {r.of} MCQs ({Math.round(r.pct * 100)}%)</span></span>
      </p>
      <HlBar value={r.pct} thick label="Readiness" />
      {r.evidence < 0.3 && <p className="text-[13px] text-pencil">Rough estimate so far: concepts you haven't tried count as a 25% guess.</p>}
    </Link>
  );
}

/** One ruled row per chapter: sticky-tab colour, seen and mastered progress, projected marks. */
export function ChapterTable() {
  const attempts = useAttempts();
  const { masteryN } = useSettings();
  const r = useReadiness();
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[21px] font-extrabold">Chapters</h2>
        <p className="hidden text-[13px] text-pencil sm:block">Seen, mastered, projected marks of 10</p>
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {content.chapters.map((ch) => {
          const p = chapterProgress(ch.conceptIds, attempts, masteryN);
          const proj = r.chapters.find((c) => c.id === ch.id)?.projected ?? 0;
          return (
            <li key={ch.id}>
              <Link to={`/learn/${ch.id}`} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 py-3 hover:bg-sheet sm:grid-cols-[auto_minmax(0,1fr)_4.5rem_4.5rem_2.25rem] sm:gap-x-4">
                <span className="row-span-2 h-9 w-1.5 rounded-sm sm:row-span-1" style={{ background: TAB[ch.id] }} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">Ch {ch.id} {CHAPTER_SHORT[ch.id]}</span>
                  <span className="block text-[13px] text-pencil">{ch.conceptIds.length} concepts{ch.id === 4 ? ', short answer guaranteed' : ch.id === 7 ? ', no short answer' : ''}</span>
                </span>
                <span className="col-start-2 grid grid-cols-[1fr_1fr_2.5rem] items-center gap-3 sm:contents">
                  <span className="space-y-1" title={`Seen ${p.seen} of ${p.total}`}>
                    <span className="block text-[12px] text-pencil sm:hidden">Seen {p.seen}/{p.total}</span>
                    <HlBar value={p.coverage} tone="faint" label={`Ch ${ch.id} seen`} />
                  </span>
                  <span className="space-y-1" title={`Mastered ${p.mastered} of ${p.total}`}>
                    <span className="block text-[12px] text-pencil sm:hidden">Mastered {p.mastered}/{p.total}</span>
                    <HlBar value={p.mastery} tone="tick" label={`Ch ${ch.id} mastered`} />
                  </span>
                  <span className="text-right text-[15px] font-semibold tabular-nums">{proj.toFixed(1)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Readiness detail for the Progress page. */
export function ReadinessDetail() {
  const r = useReadiness();
  return (
    <section className="card space-y-4 sm:p-6">
      <ReadinessBar />
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        {r.chapters.map((c) => (
          <Link key={c.id} to={`/learn/${c.id}`} className="space-y-1" title={`${CHAPTER_SHORT[c.id as ChapterId]}: about ${c.projected.toFixed(1)} of ${c.of}`}>
            <span className="flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TAB[c.id as ChapterId] }} />Ch {c.id}</span>
              <span className="tabular-nums text-pencil">{c.projected.toFixed(1)}</span>
            </span>
            <HlBar value={c.projected / c.of} label={`Ch ${c.id} projected`} />
          </Link>
        ))}
      </div>
      {r.weakest.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Weakest concepts you've tried</h3>
          <ul className="divide-y divide-rule border-y border-rule">
            {r.weakest.map((w) => (
              <li key={w.conceptId}>
                <Link className="flex items-center justify-between gap-3 py-2 text-[15px] hover:bg-paper" to={`/lesson/${w.conceptId}`}>
                  <span>{conceptById.get(w.conceptId)?.title}</span>
                  <span className="shrink-0 tabular-nums text-redpen">{Math.round(w.p * 100)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="max-w-[72ch] text-[13px] text-pencil">
        How it's estimated: for each concept, your last 8 answers give a knowledge score (newer answers count more, correct guesses count half), and it fades once the concept is
        past its spaced-repetition review date. The chance of getting a question right is 25% plus 75% of that knowledge. Each chapter is about 10 of the 60 MCQs. Short answers
        aren't included.
      </p>
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
  let action = 'Start';
  let progress: number | undefined;
  switch (t.kind) {
    case 'learn': {
      const chs = [...new Set(t.conceptIds.map((c) => conceptById.get(c)?.chapter))].filter(Boolean);
      body = <>Learn {t.conceptIds.length} new concept{t.conceptIds.length === 1 ? '' : 's'} <span className="text-pencil">from Ch {chs.join(', ')}</span></>;
      to = `/learn/${conceptById.get(t.conceptIds[t.done] ?? t.conceptIds[0])?.chapter ?? ''}`;
      action = 'Learn';
      progress = today ? t.done / t.conceptIds.length : undefined;
      break;
    }
    case 'practice':
      body = <>Answer {t.target} practice questions</>;
      to = '/practice';
      action = 'Practise';
      progress = today ? t.done / t.target : undefined;
      break;
    case 'review':
      body = t.target ? <>Clear {t.target} owed mistake{t.target === 1 ? '' : 's'}</> : <>Clear any new mistakes in the notebook</>;
      to = '/mistakes';
      action = 'Review';
      progress = today && t.target ? t.done / t.target : undefined;
      break;
    case 'mock':
      body = <>Sit a full mock midterm <span className="text-pencil">(60 MCQs and 2 short answers, 2 hours)</span></>;
      to = '/mock';
      action = 'Start mock';
      break;
    case 'final':
      body = <>Light day: read your last-night sheet, then sleep early</>;
      to = '/last-night';
      action = 'Open sheet';
      break;
  }
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[12px] font-bold ${done ? 'border-tick text-tick' : 'border-pencil/50'}`} aria-label={done ? 'Done' : 'Not done'}>{done ? '✓' : ''}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={`text-[15px] ${done ? 'text-pencil line-through decoration-tick decoration-2' : ''}`}>
          {body}
          {today && progress !== undefined && !done && <span className="ml-1.5 text-[13px] tabular-nums text-pencil">{Math.round(progress * 100)}%</span>}
        </p>
        {today && progress !== undefined && !done && <HlBar value={progress} label="Task progress" />}
      </div>
      {today && to && !done && <Link to={to} className="btn-ghost shrink-0 px-3 py-1 text-[13px]">{action}</Link>}
    </li>
  );
}

export function PlanCard({ all = false }: { all?: boolean }) {
  const plan = usePlan();
  if (!plan.length) {
    return (
      <section className="card space-y-1">
        <h2 className="text-[21px] font-extrabold">Study plan</h2>
        <p className="text-[15px] text-pencil">It's exam day, or the date has passed. Warm up with a few questions you're sure of. You can change the date in Settings.</p>
      </section>
    );
  }
  const days = all ? plan : plan.slice(0, 1);
  return (
    <section className="card space-y-3 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[21px] font-extrabold">{all ? `Study plan: ${plan.length} day${plan.length === 1 ? '' : 's'} left` : 'Today'}</h2>
        {!all && <Link to="/progress" className="text-[13px] text-pencil underline decoration-rule underline-offset-4 hover:text-ink">See the full plan</Link>}
      </div>
      {days.map((d) => (
        <div key={d.date}>
          {all && <h3 className="mt-2 text-[15px] font-semibold">{dayLabel(d)}</h3>}
          <ul className="divide-y divide-rule">
            {d.tasks.map((t, i) => <TaskRow key={i} t={t} today={d.index === 0} />)}
          </ul>
        </div>
      ))}
      {all && <p className="text-[13px] text-pencil">Re-planned every morning from what's left. New lessons go in the first days, the last day is review only, and the mock sits two days before the exam so there's time to fix what it shows.</p>}
    </section>
  );
}
