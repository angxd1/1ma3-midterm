import { BADGES, levelThreshold } from '../lib/gamify';
import { useProgress } from '../lib/hooks';
import { LevelStrip, PlanCard, ReadinessCard } from '../components/ProgressWidgets';

export default function Progress() {
  const { badges, level, xp, streak } = useProgress();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Progress</h1>
      <LevelStrip />
      <ReadinessCard detailed />
      <PlanCard all />
      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Badges · {badges.size}/{BADGES.length}</h2>
          <p className="text-xs text-slate-500">{xp} XP total · next level at {levelThreshold(level.level + 1)} · best streak {streak.best} day{streak.best === 1 ? '' : 's'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGES.map((b) => {
            const got = badges.has(b.id);
            return (
              <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${got ? 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20' : 'border-slate-200 opacity-60 dark:border-slate-800'}`}>
                <span className={`text-2xl ${got ? '' : 'grayscale'}`}>{got ? b.icon : '🔒'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{b.name}</p>
                  <p className="text-[11px] leading-tight text-slate-500">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
