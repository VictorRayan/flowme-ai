# Testimonials Carousel Spec

Date: 2026-07-04

## Goal

Convert testimonials into an autoplay social proof carousel with image-led side previews and one active center testimonial.

## UX Intent

The section should feel like there are multiple real users behind the product. The active testimonial is readable; the previous and next testimonials appear as smaller portrait-only previews.

## Product Owner Criteria

- Include Victor and Leticia.
- Victor role: Revenue Operations & Engenheiro de Software.
- Leticia role: Analista de CRM.
- Each testimonial has five stars.
- The carousel auto-advances and has dots below.
- Left and right states show only the image, minimized.

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
- 1440x900: side portraits are visible and centered rhythm matches the reference.

## Regression Risks

- Missing real portrait files may reduce perceived proof quality.
- Absolute positioning can clip copy on small screens.
- Autoplay can be too fast if users cannot read the centered quote.

## Rollback

Keep testimonial content but replace carousel positioning with a static stacked list on mobile if readability drops.
