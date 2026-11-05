import { useState } from 'react';
import { useSettings } from '../lib/hooks';
import { exportProgress, importProgress, resetProgress, sendMagicLink, signOut, syncNow, updateSettings, useStore } from '../lib/store';
import { syncConfigured } from '../lib/sync';

export default function SettingsPage() {
  const s = useSettings();
  const user = useStore((st) => st.user);
  const sync = useStore((st) => st.sync);
  const syncError = useStore((st) => st.syncError);
  const lastSync = useStore((st) => st.lastSync);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Account & sync</h2>
        {!syncConfigured ? (
          <p className="text-sm text-slate-500">Cloud sync isn't configured for this build (Supabase env vars missing). Progress is saved on this device. See SETUP.md.</p>
        ) : user ? (
          <div className="space-y-2 text-sm">
            <p>Signed in as <b>{user.email}</b> · status: {sync}{lastSync ? ` · last synced ${new Date(lastSync).toLocaleTimeString()}` : ''}</p>
            {syncError && <p className="text-rose-600">{syncError}</p>}
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => void syncNow()}>Sync now</button>
              <button className="btn-ghost" onClick={() => void signOut()}>Sign out</button>
            </div>
            <p className="text-xs text-slate-500">Signing out keeps a local copy; signing in on another device pulls your full history.</p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await sendMagicLink(email);
                setMsg('Check your email for the sign-in link.');
              } catch (err) {
                setMsg(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary shrink-0">Email me a magic link</button>
          </form>
        )}
        {msg && <p className="text-sm">{msg}</p>}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Study</h2>
        <label className="block text-sm">
          Exam date
          <input className="input mt-1" type="date" value={s.examDate} onChange={(e) => e.target.value && updateSettings({ examDate: e.target.value })} />
        </label>
        <label className="block text-sm">
          Mastery threshold: <b>{s.masteryN}</b> correct answers
          <input className="mt-2 w-full" type="range" min={3} max={5} step={1} value={s.masteryN} onChange={(e) => updateSettings({ masteryN: Number(e.target.value) })} />
        </label>
        <div className="text-sm">
          Daily XP goal
          <div className="mt-1 flex flex-wrap gap-2">
            {[100, 150, 250, 400].map((g) => (
              <button key={g} className={`chip border px-3 py-1.5 ${s.dailyGoal === g ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`} onClick={() => updateSettings({ dailyGoal: g })}>{g} XP</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">About 10 XP per correct answer, 20 per lesson, 100 for finishing a mock.</p>
        </div>
        <div className="text-sm">
          Theme
          <div className="mt-1 flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={`chip border px-3 py-1.5 capitalize ${s.theme === t ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`} onClick={() => updateSettings({ theme: t })}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              const blob = new Blob([exportProgress()], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `1ma3-progress-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export progress (JSON)
          </button>
          <label className="btn-ghost cursor-pointer">
            Import progress
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const n = await importProgress(await f.text());
                  setMsg(`Imported ${n} new attempts (merged with existing progress).`);
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : String(err));
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-2 border-rose-200 dark:border-rose-900">
        <h2 className="font-semibold text-rose-700 dark:text-rose-300">Danger zone</h2>
        <p className="text-sm text-slate-500">Deletes all attempts on this device and in the cloud. Export a backup first.</p>
        <button
          className="btn-danger"
          onClick={async () => {
            if (prompt('Type RESET to delete all progress on every device.') !== 'RESET') return;
            await resetProgress();
            setMsg('Progress reset.');
          }}
        >
          Reset progress
        </button>
      </section>
    </div>
  );
}
