# Personal Assistant Narrative, Reminder Fold, FAQ And Testimonials

Date: 2026-07-06

## Goal

Reposition the landing page around one plain promise: Flow Me is the personal
assistant that centralizes WhatsApp, agenda, reminders, notes, finance,
documents and work in one conversation.

## Surface

- `public/index.html`: hero copy, section order, reminder fold, testimonials,
  FAQ and testimonial assets.
- `public/styles.css`: reminder fold, lock-screen phone, compact testimonial
  carousel and FAQ spacing.
- `public/landing.js`: locale copy for hero, reminder fold, FAQ and testimonials.
- `public/assets/testimonials/*`: real testimonial photos.
- `AGENTS.md`: explicit Flesch-Kincaid check for broad copy work.
- `IMPLEMENTATION_PLAN.md`: execution checklist for this change.

## UX Outcome

- First viewport: the visitor understands Flow Me as a personal assistant on
  WhatsApp, not a broad AI council.
- Second fold: the visitor sees the most concrete value first: Flow Me reminds
  them before important commitments are missed.
- Testimonials: real faces replace abstract avatars, with a shorter fold so the
  previous and next section remain visible sooner.
- FAQ: answer common connector and routine questions without requiring technical
  vocabulary.

## Product Owner Notes

- Conversion intent: make the product feel useful for daily life before the user
  reaches pricing.
- Main claim: centralize routine and work through one assistant.
- Required topics: WhatsApp, reminders, notes, finance, Slack, Docs, Drive and
  Sheets.
- Do not regress: pricing gate, lead capture, legal links, footer support email,
  locale routes and Google OAuth public pages.

## Implementation Checklist

- [x] Replace broad expert-council hero copy with shorter personal-assistant
  copy.
- [x] Add a second fold titled `Nunca mais esqueca um compromisso`.
- [x] Move the `Em breve` fold below the main conversion and FAQ content.
- [x] Replace testimonial SVGs with real testimonial photos.
- [x] Reduce testimonial stage height and active card size.
- [x] Add FAQs for WhatsApp, reminders, Slack, Docs, Drive, Sheets, finance and
  notes.
- [x] Keep `/`, `/pt-br` and `/en-us` copy coherent.
- [x] Run a whole-page Flesch-Kincaid style readability audit before finalizing.

## Responsive Behavior

- 390x844: reminder phone stacks under copy, notifications stay inside the lock
  screen, testimonial card does not exceed viewport width.
- 768x1024: reminder fold uses a balanced two-column layout or clean stack
  depending on available width.
- 1024x768 and 1440x900: hero remains first, reminder fold is visible after the
  ticker, testimonials take less vertical space than before.

## Test Plan

- Browser render checks at 390x844, 768x1024, 1024x768 and 1440x900.
- Verify `/`, `/pt-br` and `/en-us`.
- Check no horizontal overflow.
- Check testimonial images load with non-zero natural size.
- Check pricing modal and CTA anchors still work.
- Check FAQ has the expected expanded connector topics.
- Run `git diff --check`.

## Readability QA

- Flesch-Kincaid rough proxy on rendered `/pt-br`: grade 9.73, 4.18 words per
  sentence, 2.01 syllables per word. The Portuguese score is treated as a proxy;
  the copy uses short sentences and concrete verbs.
- Flesch-Kincaid on rendered `/en-us`: grade 5.83, 4.14 words per sentence,
  1.68 syllables per word.
- Copy cuts applied: removed the broad expert-council hero claim, replaced it
  with personal assistant language, and kept the second fold focused on one
  concrete outcome: reminders before missed commitments.

## Regression Risks

- Locale copy can drift if new static sections are not wired in `landing.js`.
- The lock-screen phone can overflow on narrow mobile if notification copy is
  too long.
- Real testimonial photos can become too large if CSS dimensions are unstable.

## Rollback Note

Revert this spec plus the paired edits in `public/index.html`,
`public/styles.css`, `public/landing.js`, `AGENTS.md`, `IMPLEMENTATION_PLAN.md`
and the new testimonial image files.
