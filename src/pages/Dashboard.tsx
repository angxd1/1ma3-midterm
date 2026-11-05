import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { owedMcqs } from '../lib/content';
import { useAttempts, useSettings, daysUntil, useNow } from '../lib/hooks';
import { getKv, useStore } from '../lib/store';
import { ChapterTable, LevelLine, PlanCard, ReadinessBar } from '../components/ProgressWidgets';
import { isQuestion } from '../lib/gamify';

const DRILLS: [string, string, string][] = [
  ['/lightning', 'Lightning round', '60 seconds, as many as you can'],
  ['/flashcards', 'Flashcards', 'Key terms on a spaced schedule'],
  ['/confusables', 'Confusable pairs', 'Side-by-side comparisons and a drill'],
  ['/mistakes', 'Mistake notebook', 'Everything you got wrong, with notes'],
  ['/last-night', 'Last-night sheet', 'A printable review of your weak spots'],
];

export default function Dashboard() {
  const attempts = useAttempts();
  const settings = useSettings();
  const now = useNow(60_000);
  useStore((s) => s.kv['mock']);
  const days = daysUntil(settings.examDate, now);
  const owed = useMemo(() => owedMcqs(attempts).length, [attempts]);
  const answered = attempts.filter(isQuestion).length;
  const mock = getKv<{ submitted?: boolean }>('mock');
  const mockInProgress = !!mock && !mock.submitted;
  const examDay = new Date(settings.examDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div>
          <p className="text-[15px] text-pencil">COMMERCE 1MA3 midterm, {examDay}</p>
          <h1 className="text-[33px] font-extrabold leading-[1.1] tracking-tight sm:text-[41px]">
            {days > 1 ? `${days} days to the midterm` : days === 1 ? 'The midterm is tomorrow' : days === 0 ? 'Exam day. You’ve got this.' : 'The exam date has passed'}
          </h1>
          <p className="mt-1 text-[15px] text-pencil">
            {answered} questions answered
            {owed > 0 && (
              <>
                {', '}
                <Link to="/mistakes" className="font-semibold text-redpen underline decoration-redpen/40 underline-offset-4">{owed} mistakes owed</Link>
              </>
            )}
          </p>
        </div>
        <ReadinessBar />
        <div className="flex flex-wrap gap-2">
          <Link to="/practice" className="btn-primary">Start practice</Link>
          <Link to="/mock" className="btn-ghost">{mockInProgress ? 'Resume your mock' : 'Take a mock midterm'}</Link>
        </div>
      </section>

      <LevelLine />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <PlanCard />
        <ChapterTable />
      </div>

      <section className="space-y-2">
        <h2 className="text-[21px] font-extrabold">Drills</h2>
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {DRILLS.map(([to, title, sub]) => (
            <li key={to} className="border-b border-rule">
              <Link to={to} className="group block py-2.5">
                <span className="font-semibold group-hover:underline group-hover:decoration-hl group-hover:decoration-[3px] group-hover:underline-offset-4">{title}</span>
                <span className="block text-[13px] text-pencil">{sub}</span>
              </Link>
            </li>
          ))}
          <li className="border-b border-rule">
            <Link to="/learn" className="group block py-2.5">
              <span className="font-semibold group-hover:underline group-hover:decoration-hl group-hover:decoration-[3px] group-hover:underline-offset-4">Boss battles</span>
              <span className="block text-[13px] text-pencil">At the end of each chapter's path</span>
            </Link>
          </li>
        </ul>
      </section>

      <p className="max-w-[72ch] text-[13px] text-pencil">
        A concept counts as <b className="text-ink">seen</b> once you finish its lesson or answer any question on it. It's <b className="text-ink">mastered</b> after {settings.masteryN} correct
        answers (correct guesses don't count), and a wrong answer after that knocks it back down. Press <kbd>?</kbd> for keyboard shortcuts.
      </p>
    </div>
  );
}
