# Flowme LP Agent Instructions

`AGENTS.md` is the canonical instruction source for this project. Other LLM instruction files such as `CLAUDE.md` and `GEMINI.md` must only point back here and must not duplicate or fork rules.

This project is the static landing page for Flow Me. It is separate from the authenticated Next.js app in `../flowme-app`, but it must follow the same execution discipline.

Before changing landing copy, layout, animations, lead capture, pricing reveal, privacy links, or deployment files, read `IMPLEMENTATION_PLAN.md` and update the relevant checklist when the work changes scope.

Before changing a shipped section, create or update a versioned spec in `specs/` describing the UX intent, acceptance criteria, responsive behavior, test plan and regression risks.

## Source Of Truth

- `flowme-lp/` owns the public landing page served at `https://flow-me.online`.
- `flowme-app/` owns the authenticated app served at `https://app.flow-me.online`, including login, onboarding, checkout, APIs and internal product UI.
- Do not implement public landing sections in `../flowme-app/app/page.tsx`. The app root should remain app behavior, not the public marketing site.
- If a request mentions "landing", "LP", first fold, hero, plans, footer, lead form, privacy/terms, proof slider or marketing copy, edit `flowme-lp/public/**` unless the user explicitly asks for the authenticated app.

## Product Role

The landing page sells Flow Me to non-technical users. It must make the product feel usable from the first viewport, with real product signals: WhatsApp, dashboard, reminders, checklists, finance, integrations, documents, calendar and the personal assistant.

## Implementation Method

- Start with a small implementation plan for the exact change.
- Define the user-facing outcome before editing HTML/CSS/JS.
- Keep sections focused on one promise each.
- Prefer existing static patterns in `public/index.html`, `public/styles.css` and `public/landing.js`.
- Do not add frameworks or build tooling unless the implementation plan explicitly calls for it.
- Keep deployment files stable unless the request is deployment-specific.
- For every meaningful section, maintain an implementation plan and checklist with: goal, surface, copy, layout, animation, responsive behavior, links, analytics, tests and rollback note.
- Prefer static, inspectable HTML/CSS/JS. If interaction is needed, keep it in `public/landing.js` and make it deterministic enough to test with DOM fixtures.

## Agile UX Delivery Pipeline

Every meaningful landing change must follow this loop:

1. UX: define the visible user outcome, emotional tone, reference pattern, first mobile layout and failure states.
2. Product Owner: confirm the business objective, conversion intent, required copy, links, claims and what must not regress.
3. Frontend Engineer: implement in `public/index.html`, `public/styles.css` and `public/landing.js` using existing patterns and stable dimensions.
4. QA Playwright: validate 390x844, 768x1024, 1024x768 and 1440x900; check no console errors, no horizontal overflow, CTA anchors, pricing unlock, forms and animations.
5. Product Owner Review: compare screenshots against the requested narrative and decide whether the section sells the intended promise.
6. Frontend Loop: apply the smallest corrective iteration, rerun QA Playwright and update the spec/checklist before commit.

Do not skip from UX request directly to commit. Keep the loop visible in the implementation plan or the relevant `specs/` file.

## Frontend Standards

- Mobile-first is mandatory. Design for 390x844 first, then 768x1024, 1024x768 and 1440x900.
- Keep tap targets around 44px or larger.
- Avoid accidental horizontal overflow.
- Do not create scroll traps.
- Text must not overlap visual assets, cards, buttons or adjacent sections.
- Use real brand logos or official-looking variants for known tools. It is inadmissible to reference Slack, WhatsApp, Google Drive, Google Sheets, Google Calendar, Gmail or equivalent tools with generic icons.
- Use Flow Me colors, with dark premium sections, orange brand energy, green action states and restrained purple accents.
- Cards may frame repeated items, pricing and modals. Do not nest cards inside cards.
- Hero and product sections must show the actual product behavior, image, animation or interface state.
- Build the real first screen, not a generic landing hero. The first viewport must immediately communicate Flow Me, WhatsApp, personal assistant behavior and a path to plans.
- Keep the Flow Me design system consistent: black/dark premium background, Flow Me orange as the main headline accent, green for unlock/purchase states, purple for secondary controls and proof points.
- Known-tool references are product-critical. Slack, WhatsApp, Drive, Sheets, Calendar, Docs, Gmail and similar brands must use the original logo or an official/original-looking monochrome variation. A generic hash, triangle, file or chat icon is not acceptable for a named brand.
- Stable dimensions are mandatory for phones, tickers, pricing cards, modals and tool rows so animation, hover and locale copy do not shift the layout.

## Action Plan Template

For each meaningful landing change, write or maintain:

- Goal: the business and user outcome.
- Surface: files and sections affected.
- Implementation checklist: copy, layout, animation, responsive behavior, links and analytics.
- Test checklist: desktop/mobile screenshots, key links, lead form, pricing reveal, no console errors and no horizontal overflow.
- Rollback note: what to revert if the section underperforms.

## Static Test Checklist

Use browser checks for every visual change:

- 390x844 mobile.
- 768x1024 tablet.
- 1024x768 laptop.
- 1440x900 desktop.
- Check header, CTA, pricing, footer and legal links.
- Verify animated elements are not blank and do not hide critical copy.
- Verify logos render correctly and remain readable on dark/light backgrounds.
- Verify `https://flow-me.online` maps to the static LP service (`flowme-lp`) and `https://app.flow-me.online` maps to the app service (`flowme-app`) through Traefik labels before changing deployment shape.
- Run a whole-page Flesch-Kincaid style readability audit before finalizing broad copy changes. For Portuguese copy, treat the score as a rough proxy and pair it with concrete recommendations: shorter sentences, fewer clauses, fewer abstract nouns and more direct verbs.

## Mock And Render Testing

The LP is static, so mocks are DOM/data fixtures rather than API test doubles.

- Lead capture: test empty fields, invalid email, invalid phone and successful UI unlock.
- Pricing: test locked price before form and unlocked state after form.
- Locale: test `/`, `/pt-br` and `/en-us`.
- Render: test screenshots and computed layout, including viewport width and overflow.
- Network: mock or intercept marketing endpoints when validating the lead flow locally.
- Pricing reveal: ensure locked prices are blurred before form completion, annual is selected by default on mobile when required, and no CTA bypasses the unlock form straight to checkout.
- WhatsApp animation: observe a full cycle and confirm typing stops after responses, scroll stays below the WhatsApp header, and the cycle resets cleanly.
- Proof slider: confirm icons/logos are visible on dark background, do not clip at 390px, and include LGPD plus the required proof points.

## Copy Rules

- Use short, concrete sentences.
- Explain outcomes before feature names.
- Never ask users to understand IDs, OAuth, connector IDs, file IDs or technical implementation details.
- Speak like a smart operator, not a database or developer log.
- Claims must be credible and supported by visible product behavior.
- Prefer sentence-level copy that survives mobile cards without line-height crowding.
- When Flesch-Kincaid is high, recommend exact copy cuts rather than only reporting the number.
