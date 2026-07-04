# Claude Instructions For Flowme LP

Read `AGENTS.md` and `IMPLEMENTATION_PLAN.md` before changing landing page files.

Use the Flow Me landing discipline:

- Treat `flowme-lp` as the only source of truth for the public landing at `https://flow-me.online`.
- Treat `../flowme-app` as the authenticated product at `https://app.flow-me.online`; do not rebuild public LP sections in `../flowme-app/app/page.tsx`.
- Plan each section before editing.
- Build mobile-first and verify desktop after.
- Keep copy direct, concrete and non-technical.
- Do not reference known tools without original logos or official/original logo variants.
- Preserve static deployment simplicity.
- Update the implementation checklist when scope changes.
- Use Flow Me's landing design system: dark premium surfaces, orange headline energy, green unlock/purchase states, restrained purple proof/control accents and real product behavior in the first viewport.
- Use stable dimensions for iPhone mocks, sliders, pricing cards and modals so animation and translated copy do not cause layout shift.
- Known brands are product proof. Slack, WhatsApp, Drive, Sheets, Calendar, Docs, Gmail and equivalent tools require original logos or official/original-looking monochrome variants.

When implementing a request, finish the loop:

- Edit the relevant static files.
- Check links, forms, pricing reveal and footer.
- Run browser rendering checks across 390x844, 768x1024, 1024x768 and 1440x900.
- Check lead form validation, locked price blur, annual/monthly plan state, CTA anchors, no direct checkout bypass before unlock, no console errors and no horizontal overflow.
- For WhatsApp/hero animation, observe a full cycle: typing should end, responses should appear, scroll should stay below the WhatsApp header, and reset should be clean.
- Report any verification that could not be completed.
