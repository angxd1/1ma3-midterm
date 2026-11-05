# 1MA3 Midterm Prep

A gamified study app for COMMERCE 1MA3 (Intro to Marketing, Prof. Suri) — midterm chapters 3, 4, 6, 7, 8 and 9.

- **Learn**: a Duolingo-style path per chapter (one node per concept): lesson → recall questions. Each chapter card shows Coverage % and Mastery %.
- **Practice (Version A)**: endless adaptive stream (weakness weighting + SM-2 spaced repetition), confidence tagging, wrong-answer panel that explains every option, "Explore concept", combo multiplier, short answers with keyword assist.
- **Mock (Version B)**: 60 MCQ + 2 short answers, 2-hour timer with auto-submit, scantron navigator, flags, results report by chapter/concept/time.
- **Plan & motivation**: countdown study plan, readiness score (projected /60), mistake notebook with notes, XP/levels/streaks/badges.
- **Drills**: chapter boss battles (MCQ + fill-in + matching, 3 hearts), 60-second lightning round, key-term flashcards (Leitner), confusable-pairs comparisons + drill, printable last-night review sheet.
- **Keyboard**: press `?` for shortcuts; `g` then a letter jumps anywhere.
- **Sync**: Supabase magic-link login; offline-first IndexedDB cache; JSON export/import in Settings.

All content is generated from the course slides into `content/src/*.yaml` → `src/data/content.json`, with a source citation on every concept and question. See [CONCEPT_INVENTORY.md](CONCEPT_INVENTORY.md), [CONTENT_NOTES.md](CONTENT_NOTES.md) and [SETUP.md](SETUP.md).

```bash
npm install && npm run dev   # local
npm test                     # scheduler, mastery, mock/boss composition, sync merge, readiness, plan, badges, drills
npm run build                # validates content, then builds
```
