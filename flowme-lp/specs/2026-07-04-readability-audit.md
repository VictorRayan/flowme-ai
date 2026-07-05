# Readability Audit Spec

Date: 2026-07-04

## Goal

Run a whole-page Flesch-Kincaid style audit for the LP and pair the score with concrete copy recommendations.

## UX Intent

The landing page should sound premium without becoming hard to parse. Users should understand each fold quickly, especially on mobile.

## Audit Method

Use a rough Flesch-Kincaid calculation over the rendered/static page text. Because the page is in Portuguese and includes UI labels, numbers, plan features and ticker copy, treat the score as a directional proxy rather than a strict academic grade.

## Acceptance Criteria

- Report word count, sentence count, approximate grade and reading ease.
- Call out that Portuguese text makes the English formula imprecise.
- Recommend exact copy cuts when the score is high.
- Avoid broad advice without examples.

## Current Recommendations To Check

- Split long hero support copy into shorter sentences if mobile density increases.
- Keep plan feature rows short; avoid multi-clause labels.
- Prefer "Conselho com IA" in crowded cards over long phrasing.
- Avoid packing app, WhatsApp, computador and celular into a single long sentence.
- Keep proof slider text lighter and smaller than section headings.

## 2026-07-04 Result

- Characters: 10386.
- Words: 1547.
- Sentences detected: 145.
- Words per sentence: 10.67.
- Approximate Flesch-Kincaid grade: 12.25.
- Approximate Flesch reading ease: 26.26.

The score is inflated by static UI labels being read as long sentences: pricing cards, ticker items, navigation, buttons and WhatsApp mock messages collapse together when the HTML is stripped. Treat the score as a warning for dense UI copy, not as a literal Portuguese reading-grade result.

## Concrete Copy Recommendations

- In the singularity fold, split "Seja no app..." into two sentences if the paragraph crowds mobile.
- In pricing, shorten "Conselho de especialistas por inteligencia artificial" to "Conselho com IA" when space is tight.
- In pricing, shorten "Melhor preco para operar a rotina inteira" to "Melhor preco para rotina completa" if the row wraps.
- In the hero paragraph, keep the first sentence about the promise and move feature lists to bullets when mobile height is tight.
- Keep ticker labels lighter and smaller than headings so they read as proof points, not as competing headlines.

## QA Checklist

- Run audit before final broad copy changes.
- Review top long sentences manually.
- Check affected sections at 390x844 after copy cuts.

## Rollback

If copy becomes too blunt, restore the previous sentence while keeping shorter line breaks and mobile spacing.
