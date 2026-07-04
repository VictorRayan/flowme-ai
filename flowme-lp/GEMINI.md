# Gemini Instructions For Flowme LP

Before changing the landing page, read `AGENTS.md` and `IMPLEMENTATION_PLAN.md`.

Landing page work must follow:

- `flowme-lp` is the public marketing site for `https://flow-me.online`.
- `../flowme-app` is the authenticated app for `https://app.flow-me.online`; do not place public landing experiences in `../flowme-app/app/page.tsx`.
- Mobile-first layout and readable typography.
- Product-first visual evidence instead of generic marketing decoration.
- Original or official-looking logos for known products and integrations.
- Short implementation plans with checklists for execution and tests.
- Browser render checks for important visual changes.
- No technical IDs, OAuth jargon or internal tool names in user-facing copy.
- Flow Me design system: black/dark premium backgrounds, orange brand accent for the strongest headline signal, green for purchase/unlock states, purple for secondary controls/proof points, restrained borders and real product UI.
- Stable dimensions for phone mocks, proof sliders, pricing cards, tabs and modals. Text and animation must not resize or overlap controls.
- Landing test discipline: validate 390x844, 768x1024, 1024x768 and 1440x900; check no horizontal overflow, lead-form states, pricing blur/unlock, CTA anchors, legal links and console errors.

Keep Flow Me differentiated from Meu Assessor:

- Flow Me is broader than finance: WhatsApp, app, computer, mobile, agenda, checklists, finance, Slack, Drive, Sheets, documents, goals, meetings and the personal assistant.
- The narrative is "there is no right way to use it; there is your way."
- Show product behavior through WhatsApp animation, singularity/integration motion, dashboard proof and locked pricing.
