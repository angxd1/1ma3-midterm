-- 1MA3 Midterm Prep — Supabase schema. Run once in the Supabase SQL editor.
-- Single-user app, but RLS scopes every row to the signed-in user.

create table if not exists public.attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id text not null,
  concept_ids text[] not null default '{}',
  correct boolean not null,
  confidence text check (confidence in ('sure','unsure','guess')),
  mode text not null,
  ts timestamptz not null,
  meta jsonb
);
create index if not exists attempts_user_ts on public.attempts (user_id, ts);

create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.attempts enable row level security;
alter table public.kv enable row level security;

-- Attempts are append-only: insert/select/delete (delete only for "reset progress"); no update.
drop policy if exists "attempts select own" on public.attempts;
drop policy if exists "attempts insert own" on public.attempts;
drop policy if exists "attempts delete own" on public.attempts;
create policy "attempts select own" on public.attempts for select using (auth.uid() = user_id);
create policy "attempts insert own" on public.attempts for insert with check (auth.uid() = user_id);
create policy "attempts delete own" on public.attempts for delete using (auth.uid() = user_id);

drop policy if exists "kv all own" on public.kv;
create policy "kv all own" on public.kv for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
