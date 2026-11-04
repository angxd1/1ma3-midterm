# Setup — Supabase sync + Vercel deploy

The app works without any setup: progress is saved in this browser (IndexedDB). To sync across devices, do the three steps below (~10 minutes). No secrets ever go in the repo; the two values below live only in `.env.local` (git-ignored) and in Vercel's environment variables.

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **New project** (free tier is fine). Pick any name/region and save the database password somewhere safe (the app doesn't need it).
2. When it's ready, open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the `attempts` (append-only log) and `kv` (settings / in-progress mock) tables with row-level security so only your signed-in account can read or write your rows.
3. **Authentication → Sign In / Providers → Email**: make sure Email is enabled. (Magic links work out of the box; you can turn off "Confirm email" if you like.)
4. **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL (e.g. `https://1ma3-midterm-prep.vercel.app`) — set this after step 3 below.
   - **Redirect URLs**: add `http://localhost:5173` and your Vercel URL (plus `https://*-angxd1.vercel.app` if you want preview deploys to work).
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**. (The anon key is designed to be public in browser apps — RLS is what protects your data. Never use the `service_role` key here.)

## 2. Run locally (optional)

```bash
cp .env.example .env.local   # then paste the two values into .env.local
npm install
npm run dev                  # http://localhost:5173
```

## 3. Deploy to Vercel

Easiest (no CLI): <https://vercel.com/new> → **Import** the GitHub repo `angxd1/1ma3-midterm` → Framework preset **Vite** (auto-detected; `vercel.json` already sets build/output and SPA rewrites) → **Environment Variables**: add

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon/publishable key |

→ **Deploy**. Every push to `main` redeploys automatically.

Then go back to Supabase step 4 and set the Site URL / Redirect URL to the Vercel domain.

CLI alternative: `npx vercel login`, then `npx vercel --prod` from the repo (and add the two env vars with `npx vercel env add`).

## 4. Sign in on each device

Settings → enter your email → click the magic link in your inbox. Your full history downloads; new answers upload automatically (and queue offline until you're back online).

## How sync works

- Every answer is one row in an **append-only** `attempts` log (question id, concept ids, correct?, confidence, mode, timestamp). Coverage, mastery, the spaced-repetition schedule, mistakes and scores are all derived from it, so merging devices is just a set union by row id.
- Settings and the in-progress mock use last-write-wins (`kv` table).
- "Reset progress" deletes your cloud rows and writes a reset marker so stale copies on other devices are ignored.

## Content pipeline (for reference)

```bash
# one-time: extract slide text (needs python-pptx + pypdf; raw files are git-ignored in materials/)
python scripts/extract.py materials content/extracted
# compile + validate the question bank (runs automatically before every build)
npm run content
npm test
```
