# Agenda Inteligente, Finance Chart, Space Background And Singularity Fold

## Goal

Four coordinated landing updates requested on 2026-07-09:

1. New `Agenda Inteligente` section proving Google Agenda sync, modeled on the
   equivalent meuassessor.com section (same copy, brand references adapted to
   Flow Me).
2. Categorized monthly spending chart beside the phone in `Controle Financeiro`.
3. The app login screen background (particle mesh + black-hole singularity from
   `app.flow-me.online/login`) applied behind the landing page.
4. Restore the apps-orbit singularity fold removed after commit `b3952b0`, with
   WhatsApp/Balys at the center and connected apps orbiting, pitched as
   "tudo em um lugar so para o seu agente organizar por voce", now including a
   Gmail node with the official logo.

## Surface

- `public/index.html`: new `#singularidade` section (after the proof ticker),
  new `#agenda` section (after `#lembretes`), `finance-chart-card` aside inside
  `.finance-proof`, new `icon-gmail-color` symbol.
- `public/styles.css`: shared copy/check selectors extended to `.agenda-*`,
  `.gcal-*` calendar mock, `.finance-chart-card` bars, `.node-gmail` position,
  `.space-backdrop` fixed canvas wrapper, responsive rules at 1180px and 620px.
- `public/landing.js`: locale blocks (`agenda`, `financeChart`, `singularity`)
  for pt-br and en-us, `applyLocale` wiring, `setupSpaceBackground()` vanilla
  port of the app's `WaveBackground` canvas.

## UX Intent

- Agenda section mirrors the light finance pattern: purple pill eyebrow, big
  heading, three check pills, Google Agenda mock with a WhatsApp sync
  notification overlapping a faded calendar header, week row with active day and
  three colored events.
- Finance chart is a dark stat card (single-hue green bars, neutral ink labels,
  values right-aligned) reading as the product's monthly category summary; iFood
  total matches the chat mock (R$ 2.146,00).
- Space backdrop sits at `z-index: -1` behind all content; light sections keep
  their own opaque backgrounds. Pointer-follow and reduced-motion behavior match
  the login screen.
- Singularity fold restored from `b3952b0` with the original stage, node
  positions and animations; the former WhatsApp node slot is now Gmail
  (official logo), and the copy leads with "tudo em um lugar so" + agent pitch.

## Acceptance Criteria

- `/`, `/pt-br/` and `/en-us/` show all four changes localized.
- Chart bars use one hue; labels/values are text-colored, not series-colored.
- Gmail, Slack, Drive, Docs and Sheets nodes use official logos.
- Canvas backdrop does not intercept pointer events and is `aria-hidden`.
- No console errors, no horizontal overflow at 390x844, 768x1024, 1024x768,
  1440x900.

## Test Plan

- Playwright headless against `http://localhost:8080`: three locales, four
  viewports, console error capture, `scrollWidth` overflow check, screenshots
  of each new/changed section.

## QA Notes

- 2026-07-09: Playwright headless against `http://localhost:8080` on `/` at
  390x844, 768x1024, 1024x768 and 1440x900, plus `/pt-br/` and `/en-us/` at
  1440x900. All runs: no console errors, no horizontal overflow, space
  backdrop present, singularity fold with 13 orbit nodes (Gmail official
  logo included), agenda section with 3 calendar events and the WhatsApp
  sync notification, finance chart with 5 category bars and correct totals
  (R$ 4.874,40 / US$ 974.88). Locale copy verified on both dictionaries.
- 2026-07-09: Shortened the chart category "Contas da casa" to "Contas"
  ("Bills" in en-US) after the 84px label column truncated it at 1440x900.
- Screenshots reviewed: hero with space background, singularity fold,
  agenda card (desktop and 390px) and finance chart beside the phone
  (desktop and 390px stacked layout).

## Rollback Note

Revert this spec plus the matching `public/index.html`, `public/styles.css` and
`public/landing.js` hunks. Each change is additive; removing the new sections
and the `setupSpaceBackground()` call restores the previous landing.
