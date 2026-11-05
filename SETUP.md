# Setup — Supabase sync + Vercel deploy

The app works without any setup: progress is saved in this browser (IndexedDB). To sync across devices, do the three steps below (~10 minutes). No secrets ever go in the repo; the two values below live only in `.env.local` (git-ignored) and in Vercel's environment variables.

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **New project** (free tier is fine). Pick any name/region and save the database password somewhere safe (the app doesn't need it).
2. When it's ready, open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the `attempts` (append-only log) and `kv` (settings / in-progress mock) tables with row-level security so only your signed-in account can read or write your rows.
3. **Authentication → Sign In / Providers → Email**: make sure Email is enabled. (Magic links work out of the box; you can turn off "Confirm email" if you like.)
4. **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL (e.g. `https://1ma3-midterm.vercel.app`) — the public production domain, **not** a per-deployment `…-xxxx-angxd1s-projects.vercel.app` URL (those are behind Vercel login).
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

## 4. Let other people sign in (custom email sender)

Supabase's built-in email sender is for testing only: it sends sign-in links only to members of your Supabase project (you) and only a few per hour. To share the app with classmates, connect a real email service (free tiers are plenty):

1. Make a free account with an email provider that offers SMTP, e.g. **Resend** (resend.com) or **Brevo** (brevo.com).
2. Verify a sender. Resend needs a domain you own (add the DNS records it shows); Brevo can verify a single sender email address instead, which is easier if you don't have a domain.
3. Create SMTP credentials in that provider and note the **host**, **port** (usually 465 or 587), **username** and **password/API key**.
   - Resend: host `smtp.resend.com`, port `465`, username `resend`, password = an API key.
   - Brevo: host `smtp-relay.brevo.com`, port `587`, username and password from *SMTP & API → SMTP*.
4. In Supabase: **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP** and fill in sender email (the verified one), sender name (e.g. `1MA3 Midterm Prep`), host, port, username and password → **Save**.
5. **Authentication → Rate Limits**: raise *Emails sent per hour* (e.g. to 100) so a class can sign in on the same evening.
6. **Authentication → Sign In / Providers**: make sure **Allow new users to sign up** is on.
7. Test: open the app in a private window, enter a different email address than your own, and check the link arrives (look in spam the first time) and signs you in.

The SMTP password lives only in Supabase's dashboard; nothing changes in the repo or in Vercel. Each person's progress is private to their own account (row-level security), and the app still works without signing in — progress just stays on that one device.

## 5. Sign in on each device

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
