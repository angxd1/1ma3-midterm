import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../lib/hooks';
import { BADGES } from '../lib/gamify';
import { getState } from '../lib/store';

type Toast = { id: number; icon: string; title: string; body: string };

/**
 * Pops a toast when a badge is earned or a level gained. Only reacts to answers
 * made on this device just now, so history arriving via sync doesn't flood toasts.
 */
export function Celebrations() {
  const { badges, level } = useProgress();
  const prev = useRef<{ badges: Set<string>; level: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const before = prev.current;
    prev.current = { badges, level: level.level };
    if (!before) return;
    const latest = getState().attempts.reduce((m, a) => Math.max(m, a.ts), 0);
    if (Date.now() - latest > 15_000) return;
    const fresh: Toast[] = [];
    for (const b of BADGES) if (badges.has(b.id) && !before.badges.has(b.id)) fresh.push({ id: Math.random(), icon: b.icon, title: `Badge unlocked: ${b.name}`, body: b.desc });
    if (level.level > before.level) fresh.push({ id: Math.random(), icon: '⬆️', title: `Level ${level.level}!`, body: `You're now a ${level.title}.` });
    if (!fresh.length) return;
    setToasts((t) => [...t, ...fresh]);
    for (const f of fresh) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== f.id)), 5000);
  }, [badges, level.level, level.title]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-pop items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-xl dark:bg-white dark:text-slate-900">
          <span className="text-3xl">{t.icon}</span>
          <div className="text-sm">
            <p className="font-bold">{t.title}</p>
            <p className="opacity-80">{t.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
