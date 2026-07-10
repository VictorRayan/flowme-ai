# Hero, Finance And Testimonial Fixes

## Goal

Make the landing page easier to understand in the first fold, show that Flow Me
delivers WhatsApp reminders on behalf of the assistant, add financial-control
proof, and prevent long testimonials from colliding with carousel controls.

## Surface

- `public/index.html`
- `public/styles.css`
- `public/landing.js`
- `IMPLEMENTATION_PLAN.md`

## UX Intent

- The first fold should say "personal assistant on WhatsApp" quickly.
- The proof ticker should be visible at 100% zoom on desktop without requiring a
  scroll past an oversized hero.
- Push notifications should show Flow Me as the sender, with a small WhatsApp
  cue so users understand the channel.
- Financial control should feel like a real workflow: ask on WhatsApp how much
  was spent on iFood, get an AI answer, and review the categorized total.
- Testimonials should support long names and quotes without covering the
  previous/next controls or dot selector.

## Acceptance Criteria

- Hero support copy is shorter in pt-BR and en-US.
- Desktop hero uses a smaller phone mock and tighter vertical spacing.
- Each reminder notification icon includes the Flow Me logo with a WhatsApp
  badge anchored at the lower-right corner.
- A `Controle Financeiro` section exists between reminders and testimonials,
  with localized copy and visible WhatsApp/dashboard proof.
- The finance proof uses the same WhatsApp bubble/typing animation pattern as
  the hero and shows the user asking how much they spent on iFood.
- Testimonial stage height adapts to the active card and controls remain below
  the card.
- Carousel controls are at least 52px square on desktop and 46px square on
  mobile.

## Responsive Behavior

- 390x844: finance section stacks, no horizontal overflow, testimonial controls
  remain reachable below the active card.
- 768x1024: finance proof grid remains readable and does not collapse controls.
- 1024x768: hero is compact enough to show the proof ticker near the first fold.
- 1440x900: hero and ticker both appear within the first fold at 100% zoom.

## Test Plan

- Open `/`, `/pt-br/` and `/en-us/`.
- Check hero copy, CTA, proof ticker visibility and no horizontal overflow.
- Check all reminder notification badges.
- Check finance section copy, animated iFood question/answer and mock cards.
- Cycle testimonial prev/next and dots with the longest testimonial active.
- Capture/inspect 390x844, 768x1024, 1024x768 and 1440x900.

## QA Notes

- 2026-07-08: Playwright headless checked 1440x900, 1024x768, 768x1024 and
  390x844 against `http://localhost:8081/`.
- Mocked marketing endpoints during local QA to avoid expected CORS noise from
  the production lead API.
- Confirmed no console errors with mocks, no horizontal overflow, 3 WhatsApp
  notification badges, proof ticker visible in the first fold, and positive
  spacing between the active testimonial card and carousel controls.
- 2026-07-08: Rechecked finance section at 390x844, 768x1024, 1024x768 and
  1440x900 against `http://localhost:8080/pt-br/`; confirmed animated iFood
  question/answer, visible summary rows and no horizontal overflow.
- 2026-07-08: Updated the finance mock monthly iFood total to R$ 2.146,00
  (en-US: US$ 429.20) with the average order recomputed for 7 orders
  (R$ 306,57 / US$ 61.31) in `public/index.html` and `public/landing.js`.
- 2026-07-08: Added an expense-logging exchange before the iFood question
  ("Paguei 62 reais no mercado" -> "Anotado! R$ 62,00 registrado em Mercado.";
  en-US grocery equivalent). Locale copy moved from `userMessage`/`botMessage`
  strings to `userMessages`/`botMessages` arrays applied with `setTexts`.

## Regression Risks

- Locale script may miss new finance copy if selectors drift.
- Absolute-positioned testimonial slides can report the wrong height before
  images finish loading.
- The notification badge can become too small on mobile if icon dimensions are
  reduced again.

## Rollback Note

Revert this spec and the matching `public/index.html`, `public/styles.css`,
`public/landing.js`, and `IMPLEMENTATION_PLAN.md` changes if the hero compacting
or finance section reduces conversion clarity.
