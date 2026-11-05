# Frontend polish plan

Brief from your answers: **marked-up study notes**, subtle (no paper textures or handwriting), palette my choice, every screen in scope, quick celebratory feedback, phone and laptop equally, light/dark following the device, and the name stays 1MA3 Midterm Prep.

**Subject:** COMMERCE 1MA3 midterm prep. **Audience:** first-year McMaster commerce students (you, then classmates) cramming in the final days. **Primary job:** get from "where am I weak?" to answering the right question in one tap, and make each right answer feel earned.

## The idea

The app should feel like your own notes after a good study session: dark ink on clean paper, key ideas swiped with a highlighter, chapters marked with sticky tabs, and corrections in red pen. The **highlighter stroke** is the one bold element. It fills progress, marks key terms, and swipes across a correct answer. Everything else stays quiet.

## Name

Keep **1MA3 Midterm Prep** (decided).

## Colour

No cream background and no blue-only brand. Ink, highlighter and red pen come straight from studying.

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#F6F7F9` (cool white) | `#141821` | page background |
| `sheet` | `#FFFFFF` | `#1C212D` | surfaces (cards, question sheet) |
| `ink` | `#1C2B4A` (navy ink) | `#E4E8F1` | main text, primary buttons |
| `pencil` | `#5E6779` | `#9AA3B5` | secondary text, rules, borders |
| `highlight` | `#FFE14D` | `#E9C62E` | progress fills, key terms, correct swipe, current item |
| `red-pen` | `#C42F3B` | `#F06B73` | wrong answers, owed mistakes, strike-throughs |
| `tick` | `#1E7A4C` | `#4CC38A` | correct/mastered ticks (text and icons, never big fills) |

Text on the highlighter is always `ink` (about 11:1 in light). Dark mode keeps the highlighter as a muted fill behind light text where needed, and checks contrast.

**Sticky tabs per chapter.** These are muted sticky-note colours used only on the chapter tab, the path's tab edge and a small chapter chip, never for whole cards:

| Ch 3 | Ch 4 | Ch 6 | Ch 7 | Ch 8 | Ch 9 |
|---|---|---|---|---|---|
| `#F4A6A0` rose | `#8EC5E8` sky | `#9BD8B5` mint | `#C3B1E8` lilac | `#F7C08A` apricot | `#C9DB7A` lime |

## Type

Two clearly different families, both from Google Fonts:

- **Atkinson Hyperlegible Next** (sans) for interface text: navigation, buttons, labels, numbers. It was built for legibility, which suits tired eyes the night before. Weights are 400, 600 and 800.
- **Literata** (book serif) for reading content: question stems, lesson explanations, model answers, the last-night sheet. Questions read like a textbook and the interface reads like a tool. It gets slightly more line height (1.6).

Type scale (about 1.25 ratio): 13 · 15 · 17 (body) · 21 · 26 · 33 · 41. Headings use sentence case. There are no all-caps eyebrow labels. Line length stays under about 72 characters for reading text.

## Layout

The page is left-aligned. Cards are only used where something is a separate object you can act on, such as a question, a plan item or a chapter. Plain sections are separated by space and a pencil rule, with no box around them. Corner radius follows the object: question sheets are 6px (paper), buttons 10px, tabs square on the bound side.

**Home, laptop:**
```
Margin for COMMERCE 1MA3                   [sync] [⚙]
────────────────────────────────────────────────────────
4 days to the midterm                ┌ Today ───────────┐
Monday, November 9                   │ ▢ Learn 12 ideas │
                                     │ ▣ 40 questions   │
Readiness  ███████████░░░░░  38/60   │ ▢ Clear 3 owed   │
                                     └──────────────────┘
[3][4][6][7][8][9]   ← sticky tabs = chapter switcher
Ch 4 Consumer behaviour   seen ██████░  mastered ██░░░░
────────────────────────────────────────────────────────
Drills: Lightning · Flashcards · Confusable pairs · …
```
**Home, phone:** the same order stacked. The countdown and readiness bar come first, then Today, then the chapter tabs with progress for the selected chapter, so there's no 6-card wall.

**Question sheet (practice, lesson, mock, boss):**
```
┃ Ch 4  Consumer behaviour            Review: missed before
┃
┃ Buying a gift for your future mother-in-law feels
┃ riskier than buying one for an office grab bag…   (Literata)
┃
┃  1  Physiological risk
┃  2  Financial risk           ← chosen + wrong: red-pen strike
┃  3  Psychological risk       ← correct: highlighter swipe
┃  4  Performance risk
┃
┃ Sure · Unsure · Guessing                       [Check]
```
The left edge of the sheet carries the chapter's tab colour. The explanation panel reads like a margin note: pencil-coloured, with each option's reason beside it.

**Learning path:** the same winding path, drawn as a pencil line. Nodes are round stickers: unseen nodes are outlined in pencil, seen nodes are filled with ink, mastered nodes get a highlighter ring and a tick, and the current node is circled. The boss is a larger tab-coloured sticker. The chapter switcher becomes the sticky tabs.

**Mistakes, progress and drills:**
- The notebook looks like ruled entries, not cards. Each wrong pick is crossed out in red pen with the right answer highlighted, and your note sits in the margin.
- Badges are small stamped stickers. Locked ones are shown as pencil outlines instead of grey cards.
- Flashcards keep a card shape because they are physical objects in this metaphor.

## Motion (quick, about 150–300ms, off with reduced motion)

- **Correct:** a highlighter swipe across the right option from left to right in 250ms, and the XP number ticks up.
- **Wrong:** a red-pen strike through your choice, and the right one is highlighted.
- **Level up or badge:** the toast slides in with a highlighter fill.
- **Boss win:** a "Beaten" stamp on the boss sticker, shown once.
- There are no entrance animations on sections and no hover lift on every card.

## Copy

- Plain verbs and sentence case. Buttons say what happens: "Check answer", "Next question", "Start mock".
- Remove decorative arrows ("Full plan →") and most middle-dot strings.
- Empty states say what to do next.
- Words stay consistent across screens: "owed" mistakes, "seen" and "mastered" concepts.

## Implementation order (each step builds and is checked at phone and laptop width in both themes)

1. **Foundations:** fonts, colour tokens as CSS variables with light and dark values, Tailwind mapping, and the base pieces: button, sheet, sticky tab, highlighter bar, chip and focus ring. Swap the name and favicon.
2. **Question sheets:** McqCard, short answer, fill-in, matching, mock question and scantron, and the correct/wrong motion.
3. **Home dashboard:** countdown, readiness bar, today's plan, chapter tabs and the drills row.
4. **Learning path and lesson page.**
5. **Mistakes, progress, badges, flashcards, lightning, confusable pairs, last-night sheet and settings.**
6. **Copy pass, accessibility check** (contrast, keyboard focus, reduced motion), screenshots, deploy, then a tag.

No features or data change. This is a visual and wording pass only, so progress and sync are untouched.
