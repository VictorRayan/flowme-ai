# Memory Notes Section Spec

Date: 2026-07-04

## Goal

Add a premium section showing Flow Me as a notes, meetings, insights and long-term memory system.

## UX Intent

The section must feel like a concrete product demonstration, not generic feature cards. It should show that users can speak or write ideas, record meetings, save insights and later ask the Assistant to find the context.

## Product Owner Criteria

- The fold says Flow Me organizes what is in the user's head.
- It includes project organization, meeting recording, saved insights and WhatsApp consultation.
- It highlights notes and long-term memory.
- It includes a graph demo showing centralization of notes, meetings, files, people and tasks.
- Copy stays short enough for mobile cards.

## Frontend Checklist

- Add the section in `public/index.html` after the feature map and before WhatsApp-specific proof.
- Style with Flow Me dark premium background and high-contrast light cards.
- Use stable card heights and a responsive grid.
- Keep the graph inside its card at 390px without horizontal overflow.
- Keep the section accessible with semantic headings and labels.

## QA Playwright Checklist

- 390x844: graph and cards do not overflow.
- 768x1024: grid remains readable.
- 1024x768 and 1440x900: wide card and graph card preserve hierarchy.
- No console errors.
- No horizontal overflow.

## Regression Risks

- Overlong Portuguese text may crowd the cards.
- Graph nodes may overlap on small screens.
- Light cards can feel disconnected from the dark Flow Me design system if contrast or spacing drifts.

## Rollback

Remove `.memory-section` markup and the related CSS block if the fold underperforms, leaving surrounding sections intact.
