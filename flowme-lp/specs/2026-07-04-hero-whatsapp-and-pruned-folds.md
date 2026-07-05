# Hero WhatsApp And Pruned Folds

## Goal

Make the first viewport feel closer to a real WhatsApp/iPhone conversation and remove the requested middle folds so the page moves faster from hero to proof, plans and FAQ.

## User Outcome

Visitors immediately see a believable WhatsApp assistant mock, then social proof and pricing without passing through repeated feature explanations.

## Surface

- `public/index.html`
- `public/styles.css`
- `public/landing.js`

## Acceptance Criteria

- Hero status bar uses real-looking signal, Wi-Fi and battery shapes.
- Hero WhatsApp header uses back, video and phone icons instead of placeholder text glyphs.
- Hero compose row uses plus, input cursor, smile, camera and microphone icons.
- Removed folds do not render: assistant organization, council, product map, notes/memory, WhatsApp/reminders, finance and generic use cases.
- Testimonials remain on the page without the phrase "Rotinas reais. Menos ruido."
- Testimonials include proof stats, one readable active quote, five stars and carousel controls.
- Header and footer links point only to existing sections.

## Responsive Behavior

- At 390x844, the iPhone mock stays inside the viewport width and the active testimonial stacks image above copy.
- At 1440x900, the hero keeps the WhatsApp phone visible in the first viewport and testimonials show a wide active card with side previews.

## Test Plan

- Open `http://localhost:4173/`.
- Check 390x844 and 1440x900 screenshots.
- Search the DOM for removed headings and confirm none remain.
- Verify no console errors and no horizontal overflow.

## Regression Risks

- Locale script can overwrite testimonial headings if copy keys drift.
- Removed anchors can leave stale nav/footer links.
- Inline SVG icons can compress if the WhatsApp header columns become too narrow.

## Rollback

Restore the removed fold blocks if the page needs the longer education path again. Keep the hero icon replacement unless the phone mock is replaced entirely.
