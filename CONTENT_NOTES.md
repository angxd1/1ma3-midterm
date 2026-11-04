# Content Notes — ambiguities & decisions

Items flagged during extraction rather than guessed. **Bold = needs your call.**

## Exam facts
1. Exam date: midterm info PDF (p.1) says Friday Nov 13, 2026 7–9 PM (MDCL 1305). **Decision (user): keep default Monday Nov 9, 2026** (editable in Settings).
2. The midterm info PDF (p.2) says "All content from the textbook, class activities and live lectures are fair game." The app is grounded only in the slides provided; textbook-only content won't be covered.
3. "Format and type of questions will be the same as the class test" (p.5): no class test was provided.

## Missing materials
4. **The ~60 Avenue practice MCQs are not in any attached file.** They live in an Avenue quiz. If you can copy/export them (or screenshot the review pages), I'll import them verbatim.
5. "Additional MCQs (8): actual questions from last year's midterm": `1MA3 Sample Midterm Questions (1).pdf` has **9** questions. I'm treating all 9 as the past-midterm set (`official: true, pastMidterm: true`).
6. Image-only slides (no text layer). I've read the Ch 7 and Ch 9 diagrams directly. The PPTX diagram slides still need image extraction before content generation: Ch3 S3, 4, 6, 7, 15; Ch4 S4, 8, 18, 22, 23; Ch6 S4, 14, 18, 21, 31, 32, 47, 48; Ch8 S17, 22, 26, 29, 30, 33, 46, 51. Most of these are covered by speaker notes. Ch4 S18 (the three postpurchase outcomes) is not, so it will be checked from the image.

## Answer-key contradictions in slide "Test Your Knowledge" items
When the key contradicts the slide content or its own notes, I'll use the version supported by the content and record the conflict here.

7. Ch3 S43: key says **D** ("superficial intellect"). Per S39 the answer is **A, internet of things**. Will use A.
8. Ch4 S9: key says **A** for "NOT a factor affecting search", but A, B, C are all factors on S7–8. **D ("the kind of search")** is the only option not listed. Will use D.
9. Ch4 S19 key A vs S20 notes, "Build realistic expectations" → **B**.
10. Ch4 S33 key A vs S34 key → **B**.
11. Ch4 S38 key A vs S39 notes (habitual) → **B**.
12. Ch8 S11 key C (50%) vs S12 key + notes (95%) → **A**.
13. Ch6 S28–29: "NOT a key factor in segment profitability" = **purchase behaviour (C)**, yet purchase behaviour appears in the profitability formula on S26. Will keep the official key and explain that the "key factors" list is growth, competitiveness and access.
14. Ch7 and Ch9 PDFs have **no answer keys**. Keys inferred from slide text: Ch7 p.5 B, p.14 A, p.20 D, p.27 C, p.35 C, p.49 C; Ch9 p.10 A, p.14 D, p.19 C, p.22 C, p.33 A.
15. **Ch7 p.43 (typical online survey response rate)**: the answer isn't in any slide. Excluded unless you know the answer from lecture.

## Content inconsistencies
16. Generational cohort birth years: Ch3 S21 table says Gen Z after 1997, Gen Y 1981–96, Gen X 1965–80, Boomers 1946–64. The S21 notes say Gen Z after 1991, Gen Y 1982–91, Gen X 1965–81. Will use the **slide table** and won't write questions that hinge on boundary years.
17. Ch4 S23 notes say "psychological (food)" for Maslow's first level. That's a typo for **physiological** (S24). Will use S24.
18. Ch4 S32 calls the second situational factor "sensory situation". The standard term (and Ch4 notes) is "shopping situation". Will teach "shopping (sensory) situation". Practice Q5 uses "purchase situation" correctly.
19. Sample midterm Q3 offers "Routine problem solving", while the slides use "habitual decision making". Will treat them as synonyms in explanations.
20. Ch6 S6 says "IF YOU WANT TO CREATE A SEGMENT, YOU MUST USE ALL OF THE SEGMENTATION BASES". The same slide says companies "often combine multiple bases", and Additional Q7's key says companies "sometimes use a combination". Will teach "firms often combine bases" and won't claim all bases are required.
21. Ch6 S14 is titled "4 pillars", with notes listing benefits, usage rate, loyalty and occasion. The S7 table lists only three of them. Will teach all four.
22. Ch6 S49: the repositioning slide's Powerade/Gatorade caption describes *similar positioning*, not repositioning. Will use the baking-soda example from the notes.
23. Ch7 step 5 is "Determine Action Plan" in the p.7 diagram and "Present Action Plan" on p.13. Will accept both names.
24. Ch7 p.31 names "Projective techniques" with no definition, and p.30 shows "Reliability / Validity / Sampling" with no definitions. Questions will only test that projective techniques are a qualitative method. No definitions will be invented.
25. Ch9 p.2 says "Associated Services" and p.3 says "Augmented products". Will treat them as the same layer.
26. Ch9 p.4 defines product types only through examples (medical professional = specialty, apparel = shopping, soft drink = convenience, insurance = unsought). Questions stay at that level.
27. Additional Q4 (Nike swoosh / golden arches, "leaders in their industries") is keyed **D, Symbolism**, not Leadership. Will keep the key and explain it with Ch6 S42.
28. Additional Q18 (heuristics → convenience products): the slides don't directly link them. Will keep the official key and cite Ch4 S13 and Ch9 p.4.

## Out-of-scope items
29. **Off-syllabus practice questions** (Additional Practice): Q1 (B2B selling, Ch 5), Q5 (service quality / zone of tolerance, not in midterm decks), Q11 and Q12 (macro strategies / sustainable competitive advantage, Ch 2). Sample midterm Q8 (value proposition) is also from earlier chapters. Proposal: import them verbatim but tag them `outOfScope`, keep them out of the mock and mastery, and show them in an "Extra official practice" list.
30. Ch3 slides 51–68 are Ch 1/2 review questions (marketing mix, BCG matrix, growth strategies). Excluded.
31. The Chapter 1 deck was attached but Ch 1 isn't on the midterm. Excluded.
32. Lecturer's in-slide asides (e.g. "Vine crawled so TikTok could fly", "Huron Canvas") are used only as illustrative examples, never as definitions.

## Decisions (2026-11-04)
- Exam date default stays Mon Nov 9, 2026 (user choice).
- Avenue ~60 MCQs: user will practice them separately on Avenue; not imported.
- Sample midterm's 9 questions = past-midterm set.
- Off-syllabus official questions imported verbatim, tagged `outOfScope`, excluded from mock & mastery.
- Contradictory slide keys: use the content-supported answer (items 7–14). Ch7 p.43 excluded.
- Concepts NOT merged — 150 concepts.
