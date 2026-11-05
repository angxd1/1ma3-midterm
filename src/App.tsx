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
import Mistakes from './pages/Mistakes';
import Progress from './pages/Progress';
import { Celebrations } from './components/Celebrations';
import { Shortcuts } from './components/Shortcuts';
import { Icon } from './components/Icons';
import Boss from './pages/Boss';
import Lightning from './pages/Lightning';
import Flashcards from './pages/Flashcards';
import Confusables from './pages/Confusables';
import LastNight from './pages/LastNight';

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/learn', label: 'Learn', icon: 'learn' },
  { to: '/practice', label: 'Practice', icon: 'practice' },
  { to: '/mock', label: 'Mock', icon: 'mock' },
  { to: '/mistakes', label: 'Mistakes', icon: 'mistakes' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
];

function SyncBadge() {
  const user = useStore((s) => s.user);
  const sync = useStore((s) => s.sync);
  const dot = (cls: string) => <span className={`h-2 w-2 rounded-full ${cls}`} />;
  const wrap = 'inline-flex items-center gap-1.5 text-[13px] text-pencil';
  if (!syncConfigured) return <span className={wrap} title="Progress is saved on this device">{dot('bg-pencil/50')}On this device</span>;
  if (!user) return <NavLink to="/settings" className={`${wrap} hover:text-ink`}>{dot('bg-hl ring-1 ring-ink/30')}Sign in to sync</NavLink>;
  const map = {
    synced: ['bg-tick', 'Synced'],
    syncing: ['bg-hl animate-pulse', 'Syncing'],
    offline: ['bg-pencil/50', 'Offline, saved here'],
    error: ['bg-redpen', 'Sync error'],
    local: ['bg-pencil/50', 'On this device'],
  } as const;
  const [cls, label] = map[sync];
  return <NavLink to="/settings" className={`${wrap} hover:text-ink`}>{dot(cls)}{label}</NavLink>;
}

export default function App() {
  useThemeEffect();
  const ready = useStore((s) => s.ready);
  return (
    <BrowserRouter>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-rule bg-paper/90 px-4 py-3 backdrop-blur print:hidden">
          <NavLink to="/" className="text-[17px] font-extrabold tracking-tight text-ink">
            <span className="hl">1MA3</span> Midterm Prep
          </NavLink>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `rounded-md px-2.5 py-1 text-[15px] ${isActive ? 'hl font-semibold text-ink' : 'text-ink/75 hover:text-ink'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <SyncBadge />
            <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => `rounded-md p-1 ${isActive ? 'bg-hl text-slate-900' : 'text-pencil hover:text-ink'}`}>
              <Icon name="settings" />
            </NavLink>
          </div>
        </header>
        <main className="flex-1 px-4 pb-24 pt-5 md:pb-12 print:p-0">
          {!ready ? (
            <p className="p-8 text-center text-pencil">Loading your progress…</p>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/learn" element={<PathPage />} />
              <Route path="/learn/:ch" element={<PathPage />} />
              <Route path="/lesson/:id" element={<Lesson />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/mock" element={<Mock />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/mistakes" element={<Mistakes />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/boss/:ch" element={<Boss />} />
              <Route path="/lightning" element={<Lightning />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/confusables" element={<Confusables />} />
              <Route path="/last-night" element={<LastNight />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          )}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-rule bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-ink' : 'text-pencil'}`}>
              {({ isActive }) => (
                <>
                  <span className={`rounded-md px-2.5 py-0.5 ${isActive ? 'bg-hl text-slate-900' : ''}`}><Icon name={n.icon} /></span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {ready && <Celebrations />}
        <Shortcuts />
      </div>
    </BrowserRouter>
  );
}
