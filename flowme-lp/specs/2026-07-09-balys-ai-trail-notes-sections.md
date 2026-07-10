# BalysAI Chat, Activity Trail And Meeting Notes Sections

## Goal

Three new product-proof sections between `#financeiro` and `#testimonials`,
each mirroring a real app surface, plus nav links for all three:

1. `#balys`: the in-app specialized AI chat (BalysAI) with its use-case chips
   (prioritize day, adjust agenda, goal next step, important emails, analyze
   spreadsheet, weather/energy) and an animated interaction cycle.
2. `#trilha`: the "Hoje" activity trail — know what to do today, complete
   items, watch the day progress counter fill.
3. `#notas`: record meetings and get organized notes — recording pill turns
   into a summarized note card with decisions and next steps.

## Surface

- `public/index.html`: three new sections, nav links (`IA`, `Trilha`,
  `Notas`), new inline SVG marks for the Balys knot and note glyphs.
- `public/styles.css`: `.balys-*` chat panel, `.trail-*` day trail,
  `.mnotes-*` recording/note mock, responsive rules at 1180px and 620px.
- `public/landing.js`: locale blocks (`balys`, `trail`, `meetingNotes`, nav
  arrays) for pt-br/en-us; `setupBalysChat()`, `setupTrailProgress()` and
  `setupMeetingNotes()` cycle animations with reduced-motion guards.

## UX Intent

- BalysAI section is dark (matches the app): chat panel with BalysAI header,
  "IA ilimitada" pill, welcome copy, six case chips; a chip highlights, posts
  the user message, typing dots, then a grounded AI answer; two cases cycle.
- Trail section is light with a dark app card: greeting bar, day header
  "sex, jul 10" with 0/4 progress, four timed nodes on a winding path that
  complete one by one turning green while the counter and bar fill.
- Notes section is dark: pulsing REC pill with waveform becomes a typed note
  card (title, decision bullets, next-step tag); two background note cards
  suggest the notes list.
- Every section follows the existing rhythm: eyebrow pill, big heading, short
  paragraph, three check pills, mock on the other column.

## Acceptance Criteria

- Nav shows Financeiro/IA/Trilha/Notas/Depoimentos/Planos (localized) and
  anchors scroll to the right sections with `scroll-margin-top`.
- All six BalysAI chips render; the animation never leaves typing visible at
  cycle end; chips and answers are localized.
- Trail progress counter matches completed nodes at every animation step and
  resets cleanly; nodes align to the path at 390/768/1024/1440.
- Note card text types without layout shift (reserved heights); waveform and
  REC pulse pause under `prefers-reduced-motion`.
- No console errors, no horizontal overflow at 390x844, 768x1024, 1024x768
  and 1440x900 on `/`, `/pt-br/` and `/en-us/`.

## Test Plan

- Playwright headless against `http://localhost:8080`: four viewports on `/`,
  1440x900 on `/pt-br/` and `/en-us/`; console error capture, overflow check,
  per-section screenshots including mid-animation frames.

## QA Notes

- 2026-07-09: Playwright headless against `http://localhost:8080` on `/` at
  390x844, 768x1024, 1024x768 and 1440x900, plus `/pt-br/` and `/en-us/` at
  1440x900. All runs OK: nav shows the six localized anchors, six BalysAI
  chips with the animated case cycle posting user/bot messages, trail counter
  always matching completed nodes (verified `N/4` against `.is-done` count),
  three note lines typing in, timer in `mm:ss`, zero console errors and zero
  horizontal overflow.
- 2026-07-09: Raised `.trail-track` mobile height from 400px to 448px after
  the last node label ("Jantar em familia") wrapped to two lines and clipped
  at the card bottom on 390x844; re-verified label bottom sits 16px inside
  the card.
- Screenshots reviewed at 1440 and 390 for all three sections, including
  mid-animation frames (trail at 3/4, note card mid-typing).

## Rollback Note

Revert this spec plus the matching `public/index.html`, `public/styles.css`
and `public/landing.js` hunks. Sections are additive; removing the three
`setup*` calls and nav links restores the previous landing.
