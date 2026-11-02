# Unsupported landing metrics

Date: 2026-11-02

## User outcome and business objective

Visitors should understand Flow Me's notes, tasks, and WhatsApp reminders without seeing unsupported figures for active users or AI accuracy. The page should still guide them from the hero to testimonials, plans, and lead capture.

## Scope and acceptance

- Replace the two figures in the inline and main tickers with product features in PT and EN.
- Remove the three statistics cards beneath the testimonial heading, along with their localization and unused styling.
- Introduce the existing testimonial carousel with neutral wording. Keep the testimonial content and controls intact.
- Keep mobile and desktop ticker layouts, CTA links, analytics, lead form, and pricing reveal working.

## Responsive behavior and QA

- Inspect at 390x844, 768x1024, 1024x768, and 1440x900. Check no horizontal overflow, clipped ticker text, or blank space above the carousel.
- Check `/`, `/pt-br`, and `/en-us`; no unsupported figure should render in either locale.
- Check console errors, CTA anchors, testimonial controls, lead validation, pricing reveal, and animation visibility.

QA result: local Playwright render passed at all four viewport sizes across all three routes. No page errors, horizontal overflow, unsupported figures, or missing carousel, lead form, or pricing card. A settled 390px screenshot showed the testimonial card readable below the new heading. Lead submission and checkout were not exercised because this edit changes neither interaction.

## Regression risks and rollback

Removing cards changes the testimonial section height. Ticker replacements may change line length, especially in English. If spacing regresses, adjust section spacing and ticker dimensions. Restore quantitative copy only after its measurement and evidence are documented.
