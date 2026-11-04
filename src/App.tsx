import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useStore } from './lib/store';
import { useThemeEffect } from './lib/hooks';
import { syncConfigured } from './lib/sync';
import Dashboard from './pages/Dashboard';
import PathPage from './pages/PathPage';
import Lesson from './pages/Lesson';
import Practice from './pages/Practice';
import Mock from './pages/Mock';
import SettingsPage from './pages/Settings';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/learn', label: 'Learn', icon: '🗺️' },
  { to: '/practice', label: 'Practice', icon: '⚡' },
  { to: '/mock', label: 'Mock', icon: '⏱️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function SyncBadge() {
  const user = useStore((s) => s.user);
  const sync = useStore((s) => s.sync);
  if (!syncConfigured) return <span className="chip bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" title="Progress is saved on this device">Local</span>;
  if (!user) return <NavLink to="/settings" className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Sign in to sync</NavLink>;
  const map = {
    synced: ['bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', 'Synced'],
    syncing: ['bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', 'Syncing…'],
    offline: ['bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', 'Offline — saved locally'],
    error: ['bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200', 'Sync error'],
    local: ['bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', 'Local'],
  } as const;
  const [cls, label] = map[sync];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export default function App() {
  useThemeEffect();
  const ready = useStore((s) => s.ready);
  return (
    <BrowserRouter>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <NavLink to="/" className="font-extrabold tracking-tight">1MA3 <span className="text-brand-600">Midterm Prep</span></NavLink>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <SyncBadge />
        </header>
        <main className="flex-1 px-4 pb-24 pt-4 sm:pb-10">
          {!ready ? (
            <p className="p-8 text-center text-slate-500">Loading your progress…</p>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/learn" element={<PathPage />} />
              <Route path="/learn/:ch" element={<PathPage />} />
              <Route path="/lesson/:id" element={<Lesson />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/mock" element={<Mock />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          )}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex flex-col items-center py-2 text-[11px] ${isActive ? 'text-brand-600 font-semibold' : 'text-slate-500'}`}>
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  );
}
