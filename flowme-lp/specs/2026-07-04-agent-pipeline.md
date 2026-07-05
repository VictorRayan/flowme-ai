# Agent Pipeline Spec

Date: 2026-07-04

## Goal

Make every landing page iteration follow one reproducible loop: UX -> Product Owner -> Frontend Engineer -> QA Playwright -> Product Owner -> Frontend loop.

## UX Intent

Future agents must not jump straight from a screenshot request to a commit. They must identify the user-facing outcome, mobile layout, emotional tone and regression risks before changing shipped sections.

## Product Owner Criteria

- `AGENTS.md` is the single source of truth for Flow Me LP work.
- `CLAUDE.md` and `GEMINI.md` only reference `AGENTS.md`.
- Broad LP changes require a spec in `specs/`.
- Claims, CTAs, forms, pricing and legal links remain conversion-safe.
- Known tools keep original logos or official-looking logo variants.

## Frontend Checklist

- Keep public landing work inside `flowme-lp/public/**`.
- Keep app work inside `flowme-app/**`.
- Use static HTML/CSS/JS unless the implementation plan explicitly changes the stack.
- Preserve mobile-first dimensions for 390x844 before desktop refinement.
- Update `IMPLEMENTATION_PLAN.md` when scope changes.

## QA Playwright Checklist

- Render 390x844, 768x1024, 1024x768 and 1440x900.
- Check no console errors.
- Check no horizontal overflow.
- Check header, hero, proof slider, pricing unlock, lead form, legal/footer and animated sections.
- Capture screenshots when visual rhythm changes.

## Regression Risks

- Another agent may duplicate rules in secondary LLM files and create conflicting guidance.
- A visual request may bypass form/pricing rules and send users directly to checkout.
- Static sections may drift away from the deployed root-domain app.

## Rollback

Restore the previous `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` versions only if the single-source rule blocks a required workflow.
