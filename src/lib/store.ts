import { useSyncExternalStore } from 'react';
import { get, set, del } from 'idb-keyval';
import type { User } from '@supabase/supabase-js';
import type { Attempt, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { mergeAttempts } from './stats';
import { supabase, pushAttempts, pullAttempts, pullKv, pushKv, mergeKv, deleteAllRemote, type KvEntry } from './sync';

/**
 * Single app store. Attempts are an append-only log kept in IndexedDB and
 * mirrored to Supabase. Small blobs (settings, in-progress mock, reset marker)
 * live in a key/value map with last-write-wins.
 */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

interface State {
  ready: boolean;
  attempts: Attempt[];
  kv: Record<string, KvEntry>;
  user: User | null;
  sync: SyncStatus;
  syncError?: string;
  lastSync?: number;
}

let state: State = { ready: false, attempts: [], kv: {}, user: null, sync: 'local' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (p: Partial<State>) => {
  state = { ...state, ...p };
  emit();
};

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getState = () => state;
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/* ---------- derived helpers ---------- */
const resetAt = () => (state.kv['resetAt']?.value as number | undefined) ?? 0;
export const visibleAttempts = (s: State = state) => {
  const r = (s.kv['resetAt']?.value as number | undefined) ?? 0;
  return r ? s.attempts.filter((a) => a.ts > r) : s.attempts;
};
export const getSettings = (s: State = state): Settings => ({ ...DEFAULT_SETTINGS, ...((s.kv['settings']?.value as Partial<Settings>) ?? {}) });

/* ---------- persistence ---------- */
let outbox = new Set<string>();
const persist = async () => {
  await set('attempts', state.attempts);
  await set('outbox', [...outbox]);
  await set('kv', state.kv);
};
const dirtyKv = new Set<string>();

export async function initStore() {
  try {
    const [attempts, ob, kv, dk] = await Promise.all([get('attempts'), get('outbox'), get('kv'), get('dirtyKv')]);
    outbox = new Set((ob as string[]) ?? []);
    for (const k of (dk as string[]) ?? []) dirtyKv.add(k);
    setState({ attempts: (attempts as Attempt[]) ?? [], kv: (kv as Record<string, KvEntry>) ?? {}, ready: true });
  } catch {
    setState({ ready: true }); // private mode / blocked storage: run in memory
  }
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    setState({ user: data.session?.user ?? null });
    supabase.auth.onAuthStateChange((_e, session) => {
      setState({ user: session?.user ?? null });
      if (session?.user) void syncNow();
    });
    window.addEventListener('online', () => void syncNow());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
    setInterval(() => void syncNow(), 60_000);
    void syncNow();
  }
}

/* ---------- writes ---------- */
let syncTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 1500);
};

export function record(a: Omit<Attempt, 'id' | 'ts'> & { ts?: number }): Attempt {
  const full: Attempt = { ...a, id: crypto.randomUUID(), ts: a.ts ?? Date.now() };
  outbox.add(full.id);
  setState({ attempts: [...state.attempts, full] });
  void persist();
  scheduleSync();
  return full;
}

export function setKv(key: string, value: unknown) {
  const entry = { value, updatedAt: Date.now() };
  dirtyKv.add(key);
  setState({ kv: { ...state.kv, [key]: entry } });
  void persist();
  void set('dirtyKv', [...dirtyKv]);
  scheduleSync();
}
export const getKv = <T>(key: string): T | undefined => state.kv[key]?.value as T | undefined;

export function updateSettings(p: Partial<Settings>) {
  setKv('settings', { ...getSettings(), ...p });
}

/* ---------- sync ---------- */
let syncing: Promise<void> | null = null;
export function syncNow(): Promise<void> {
  if (!supabase || !state.user) return Promise.resolve();
  if (!navigator.onLine) {
    setState({ sync: 'offline' });
    return Promise.resolve();
  }
  if (syncing) return syncing;
  syncing = (async () => {
    const user = state.user!;
    setState({ sync: 'syncing' });
    try {
      // 1. kv: pull, merge LWW, push anything local that is newer
      const remoteKv = await pullKv();
      const merged: Record<string, KvEntry> = { ...state.kv };
      for (const k of new Set([...Object.keys(remoteKv), ...Object.keys(state.kv)])) {
        const m = mergeKv(state.kv[k], remoteKv[k]);
        if (m) merged[k] = m;
        if (m && (!remoteKv[k] || m.updatedAt > remoteKv[k].updatedAt)) await pushKv(user, k, m);
      }
      dirtyKv.clear();
      void set('dirtyKv', []);
      // 2. attempts: push outbox, pull everything (log is small), union
      const pending = state.attempts.filter((a) => outbox.has(a.id));
      await pushAttempts(user, pending);
      for (const a of pending) outbox.delete(a.id);
      const remote = await pullAttempts(0);
      const r = (merged['resetAt']?.value as number | undefined) ?? 0;
      const all = mergeAttempts(state.attempts, remote).filter((a) => a.ts > r);
      setState({ attempts: all, kv: merged, sync: 'synced', lastSync: Date.now(), syncError: undefined });
      await persist();
    } catch (e) {
      setState({ sync: navigator.onLine ? 'error' : 'offline', syncError: e instanceof Error ? e.message : String(e) });
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/* ---------- auth ---------- */
export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Sync is not configured (missing Supabase env vars).');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
}
export async function signOut() {
  await supabase?.auth.signOut();
  setState({ user: null, sync: 'local' });
}

/* ---------- reset / export / import ---------- */
export async function resetProgress() {
  const now = Date.now();
  outbox.clear();
  setState({ attempts: [] });
  setKv('resetAt', now);
  setKv('mock', null);
  if (state.user) {
    try {
      await deleteAllRemote(state.user);
    } catch {
      /* resetAt marker still hides old rows on every device */
    }
  }
  await persist();
}

export function exportProgress(): string {
  return JSON.stringify({ app: '1ma3-midterm-prep', version: 1, exportedAt: new Date().toISOString(), attempts: visibleAttempts(), kv: state.kv }, null, 1);
}

export async function importProgress(json: string): Promise<number> {
  const data = JSON.parse(json);
  if (data?.app !== '1ma3-midterm-prep' || !Array.isArray(data.attempts)) throw new Error('Not a 1MA3 progress export.');
  const incoming = (data.attempts as Attempt[]).filter((a) => a.ts > resetAt());
  const before = state.attempts.length;
  const merged = mergeAttempts(state.attempts, incoming);
  for (const a of incoming) outbox.add(a.id);
  const kv = { ...state.kv };
  for (const [k, v] of Object.entries((data.kv ?? {}) as Record<string, KvEntry>)) {
    const m = mergeKv(kv[k], v);
    if (m) kv[k] = m;
    dirtyKv.add(k);
  }
  setState({ attempts: merged, kv });
  await persist();
  scheduleSync();
  return merged.length - before;
}

export async function wipeLocal() {
  await del('attempts');
  await del('outbox');
  await del('kv');
}
