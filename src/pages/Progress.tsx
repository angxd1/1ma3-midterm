import { BADGES, levelThreshold } from '../lib/gamify';
import { useProgress } from '../lib/hooks';
import { LevelLine, PlanCard, ReadinessDetail } from '../components/ProgressWidgets';

export default function Progress() {
  const { badges, level, xp, streak } = useProgress();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-[33px] font-extrabold leading-tight tracking-tight">Progress</h1>
      <LevelLine />
      <ReadinessDetail />
      <PlanCard all />
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[21px] font-extrabold">Badges <span className="text-pencil">{badges.size} of {BADGES.length}</span></h2>
          <p className="text-[13px] text-pencil">{xp} XP in total. Next level at {levelThreshold(level.level + 1)}. Best streak: {streak.best} day{streak.best === 1 ? '' : 's'}.</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((b) => {
            const got = badges.has(b.id);
            return (
              <li key={b.id} className={`flex items-center gap-3 rounded-md p-2.5 ${got ? 'bg-sheet' : ''}`}>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${got ? 'bg-hl/70 ring-2 ring-ink/80 ring-offset-2 ring-offset-sheet' : 'border-2 border-dashed border-pencil/40 grayscale opacity-50'}`}
                  aria-hidden
                >
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] font-semibold leading-tight ${got ? '' : 'text-pencil'}`}>{b.name}</span>
                  <span className="block text-[12px] leading-tight text-pencil">{got ? b.desc : `Locked: ${b.desc.charAt(0).toLowerCase()}${b.desc.slice(1)}`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
