# Testimonials Carousel Spec

Date: 2026-07-04

## Goal

Convert testimonials into an autoplay social proof carousel with image-led side previews and one active center testimonial.

## UX Intent

The section should present two testimonials. The active testimonial is readable; the other testimonial appears as a smaller portrait-only preview.

## Product Owner Criteria

- Include Victor and Leticia.
- Victor role: Revenue Operations & Engenheiro de Software.
- Leticia role: Analista de CRM.
- Each testimonial has five stars.
- The carousel auto-advances and has dots below.
- The inactive state shows only the image, minimized.

## Frontend Checklist

- Add image slots under `public/assets/testimonials/`.
- Use `data-testimonial-slider`, `data-testimonial-slide`, controls and dots for deterministic JS.
- Keep active slide centered and side slides visually smaller.
- Hide side testimonial copy while keeping the active copy readable.
- Update locale copy in `public/landing.js`.

## QA Playwright Checklist

- Check all testimonial images load.
- Wait for one auto-advance and confirm the active index changes.
- Click next and previous controls.
- Check dots update `aria-current`.
- 390x844: no clipping of active testimonial copy.
- 1440x900: the side portrait is visible and the active card remains centered.

## 2026-11-02 removal

- Remove the third testimonial and its portrait from HTML, both locales, and published assets.
- Keep the carousel navigation and dot count aligned with the two remaining slides.
- Preserve the existing lead, pricing, links, and analytics flows.
- Check mobile and desktop rendering, locale switch, console errors, and slide navigation before publishing.
- QA result: local browser checks passed at 390, 768, 1024, and 1440px on `/`, `/pt-br/`, and `/en-us/`; each route rendered two slides and dots, both portraits loaded, next navigation worked, and there were no page errors or horizontal overflow.

## Regression Risks

- Missing real portrait files may reduce perceived proof quality.
- Absolute positioning can clip copy on small screens.
- Autoplay can be too fast if users cannot read the centered quote.

## Rollback

Keep testimonial content but replace carousel positioning with a static stacked list on mobile if readability drops.
