# 1MA3 Midterm Prep

A gamified study app for COMMERCE 1MA3 (Intro to Marketing, Prof. Suri) — midterm chapters 3, 4, 6, 7, 8 and 9.

- **Learn**: a Duolingo-style path per chapter (one node per concept): lesson → recall questions. Each chapter card shows Coverage % and Mastery %.
- **Practice (Version A)**: endless adaptive stream (weakness weighting + SM-2 spaced repetition), confidence tagging, wrong-answer panel that explains every option, "Explore concept", combo multiplier, short answers with keyword assist.
- **Mock (Version B)**: 60 MCQ + 2 short answers, 2-hour timer with auto-submit, scantron navigator, flags, results report by chapter/concept/time.
- **Sync**: Supabase magic-link login; offline-first IndexedDB cache.

All content is generated from the course slides into `content/src/*.yaml` → `src/data/content.json`, with a source citation on every concept and question. See [CONCEPT_INVENTORY.md](CONCEPT_INVENTORY.md), [CONTENT_NOTES.md](CONTENT_NOTES.md) and [SETUP.md](SETUP.md).

```bash
npm install && npm run dev   # local
npm test                     # scheduler, mastery, mock composition, sync merge, keyword assist
npm run build                # validates content, then builds
```
