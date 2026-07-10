# Balys Review OS Council Section

## Goal

New `#revisao` section between `#notas` and `#testimonials` selling the app's
Reviews feature (`app.flow-me.online/app/reviews`) as a weekly AI council:

1. Name the pain (the week ends and nobody audits what happened; goals die in
   silence) and show how the weekly review solves it.
2. Sell the Council: advanced reasoning, an AI that learns from your behavior
   and long-term memory across weeks.
3. Mirror the app's Review screen: "Balys Review OS" pill, weekly stats
   (commitments, done, unanswered, late postponements) and the four insight
   cards (what happened / pattern detected / goal impact / recommendation)
   with the app's cyan/orange/purple/green accent borders.
4. Nav gains a `Revisao`/`Review` link.

## Surface

- `public/index.html`: `#revisao` section, nav link after `Notas`.
- `public/styles.css`: `.review-*` copy column (pain/solution cards, council
  grid) and the review panel mock with stat tiles and accent cards.
- `public/landing.js`: `review` locale blocks (pt-br/en-us), `applyLocale`
  wiring, `setupReviewReveal()` — IntersectionObserver-triggered count-up on
  stats and staggered card reveal, static under reduced motion.

## UX Intent

- Copy column: purple pill eyebrow, big headline about a council of AI
  reviewing your week, one paragraph, then a red-accent "pain" card and a
  green-accent "solution" card, then three compact council-value cards
  (advanced reasoning / learns with you / long-term memory).
- Panel: dark navy app surface; stats count up from 0 when the section
  scrolls into view, insight cards slide in staggered, recommendation card
  lands last with a soft glow. One-shot reveal (no loop) to feel like a
  report being assembled.

## Acceptance Criteria

- Nav shows seven localized anchors and `#revisao` scrolls with the sticky
  header offset.
- Stats finish exactly at 27/2/25/0 after the count-up; cards all end
  visible; reduced motion shows the final state immediately.
- Section localized on `/`, `/pt-br/` and `/en-us/`.
- No console errors, no horizontal overflow at 390x844, 768x1024, 1024x768
  and 1440x900 (nav must still fit at 1024).

## Test Plan

- Playwright headless: four viewports on `/`, 1440x900 on `/pt-br/` and
  `/en-us/`; assert stat end values, revealed card count, nav anchor, console
  errors, overflow; screenshots desktop/mobile including mid-reveal.

## QA Notes

- 2026-07-09: Playwright headless against `http://localhost:8080` on `/` at
  390x844, 768x1024, 1024x768 and 1440x900, plus `/pt-br/` and `/en-us/` at
  1440x900. All runs OK: stats end at 27/2/25/0 after the count-up, all four
  insight cards revealed, nav shows seven localized anchors including
  `Revisao`/`Review`, header fits at 1024 with no overflow, zero console
  errors, zero horizontal overflow.
- 2026-07-09: Two fixes found by QA: (1) IntersectionObserver threshold
  lowered from 0.35 to 0.15 — the panel is taller than the 390x844 viewport
  so the reveal never fired on mobile; (2) locale `nav` arrays were missing
  the new `Revisao`/`Review` item, mislabeling the last links as
  "Planos Planos" via `setTexts` index shift.
- Screenshots reviewed at 1440 and 390 (copy column, pain/solution cards,
  council grid, panel with stats and accent cards).
- 2026-07-09: Replaced the generic review case with a Brazilian middle-class
  narrative: evening-stacked commitments never happen and boletos due before
  payday generate monthly late fees. Pattern card demystifies it ("after 7pm
  on weekdays = 80% postponed; not lack of discipline"), impact card shows
  R$ 86 lost to late fees (US$ 17 in en-US), and the recommendation drops
  the "CEO directive" framing for a concrete fix: 3 fixed mornings + shift
  due dates to the 15th via WhatsApp. Stats retell the story (18/9/6/R$ 86)
  and the count-up now preserves currency prefixes. QA re-run: all green.

## Rollback Note

Revert this spec plus the matching `public/index.html`, `public/styles.css`
and `public/landing.js` hunks. The section is additive; removing the
`setupReviewReveal()` call and the nav link restores the previous landing.
