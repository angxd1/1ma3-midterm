import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Attempt } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;
export const syncConfigured = !!supabase;

export interface KvEntry<T = unknown> {
  value: T;
  updatedAt: number;
}

/** Last-write-wins for small key/value blobs (settings, in-progress mock). */
export function mergeKv<T>(local: KvEntry<T> | undefined, remote: KvEntry<T> | undefined): KvEntry<T> | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

interface AttemptRow {
  id: string;
  user_id: string;
  question_id: string;
  concept_ids: string[];
  correct: boolean;
  confidence: string | null;
  mode: string;
  ts: string;
  meta: Record<string, unknown> | null;
}

export const toRow = (a: Attempt, userId: string): AttemptRow => ({
  id: a.id,
  user_id: userId,
  question_id: a.questionId,
  concept_ids: a.conceptIds,
  correct: a.correct,
  confidence: a.confidence,
  mode: a.mode,
  ts: new Date(a.ts).toISOString(),
  meta: a.meta ?? null,
});

export const fromRow = (r: AttemptRow): Attempt => ({
  id: r.id,
  questionId: r.question_id,
  conceptIds: r.concept_ids ?? [],
  correct: r.correct,
  confidence: (r.confidence as Attempt['confidence']) ?? null,
  mode: r.mode as Attempt['mode'],
  ts: new Date(r.ts).getTime(),
  ...(r.meta ? { meta: r.meta } : {}),
});

export async function pushAttempts(user: User, attempts: Attempt[]): Promise<void> {
  if (!supabase || !attempts.length) return;
  for (let i = 0; i < attempts.length; i += 500) {
    const { error } = await supabase
      .from('attempts')
      .upsert(attempts.slice(i, i + 500).map((a) => toRow(a, user.id)), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

export async function pullAttempts(sinceTs: number): Promise<Attempt[]> {
  if (!supabase) return [];
  const out: Attempt[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .gte('ts', new Date(sinceTs).toISOString())
      .order('ts', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data as AttemptRow[]).map(fromRow));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function pullKv(): Promise<Record<string, KvEntry>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('kv').select('key,value,updated_at');
  if (error) throw error;
  const out: Record<string, KvEntry> = {};
  for (const r of data ?? []) out[r.key] = { value: r.value, updatedAt: new Date(r.updated_at).getTime() };
  return out;
}

export async function pushKv(user: User, key: string, entry: KvEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('kv')
    .upsert({ user_id: user.id, key, value: entry.value, updated_at: new Date(entry.updatedAt).toISOString() }, { onConflict: 'user_id,key' });
  if (error) throw error;
}

export async function deleteAllRemote(user: User): Promise<void> {
  if (!supabase) return;
  const a = await supabase.from('attempts').delete().eq('user_id', user.id);
  if (a.error) throw a.error;
  const k = await supabase.from('kv').delete().eq('user_id', user.id);
  if (k.error) throw k.error;
}
