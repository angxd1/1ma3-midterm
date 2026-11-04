import { useEffect, useMemo, useState } from 'react';
import { useStore, getSettings } from './store';
import type { Attempt, Settings } from './types';

export function useAttempts(): Attempt[] {
  const attempts = useStore((s) => s.attempts);
  const resetAt = useStore((s) => (s.kv['resetAt']?.value as number | undefined) ?? 0);
  return useMemo(() => (resetAt ? attempts.filter((a) => a.ts > resetAt) : attempts), [attempts, resetAt]);
}

export function useSettings(): Settings {
  const entry = useStore((s) => s.kv['settings']);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSettings(), [entry]);
}

/** Applies the theme class and keeps a localStorage mirror so the first paint is correct. */
export function useThemeEffect() {
  const { theme } = useSettings();
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    try {
      localStorage.setItem('theme', JSON.stringify(theme));
    } catch {
      /* ignore */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function daysUntil(dateStr: string, now = Date.now()) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.ceil((target - now) / 86_400_000);
}
