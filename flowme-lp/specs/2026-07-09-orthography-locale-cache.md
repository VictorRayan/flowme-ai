# Portuguese Orthography, en-us Locale Integrity And Cache Freshness

## Goal

1. Correct Portuguese orthography across the whole LP: accents, cedillas,
   crase and é/e distinctions everywhere ("não", "você", "finanças",
   "revisão", "às 11h", "não é vantagem, é sobrevivência"...). The previous
   accent-free convention is retired.
2. `/en-us/` must render 100% English while `/` and `/pt-br/` stay 100%
   Portuguese — same LP, locale respected on both sides.
3. Users must never need to clear browser data to see a new deploy.

## Surface

- `public/index.html`: full pt copy accent pass (visible text and
  user-facing aria-labels); anchors/ids stay ASCII (`#revisao`).
- `public/landing.js`: accent pass over the pt-br dict and pt defaults;
  new locale coverage for surfaces that leaked Portuguese on `/en-us/`:
  hero WhatsApp conversation + chat header/status, proof ticker (exact-match
  `tickerMap`), testimonial proof stats, testimonials eyebrow/subtitle,
  plan feature lists, mobile plan tabs, footer (description, proof badges,
  column titles and links). New `setNodeText`/`setNodeTexts` helpers replace
  only the text node so `<time>`/`<svg>` children survive localization.
- `nginx.conf`: `Cache-Control: no-cache, must-revalidate` on every
  response (nginx still serves 304 via ETag, so repeat visits stay cheap).
- `public/index.html`: asset version bumped to `?v=20260709-locale-cache`
  so clients holding pre-header HTML refetch css/js once.
- `public/pt-br/index.html`, `public/en-us/index.html`: loader `fetch`
  uses `cache: "no-store"`.

## Acceptance Criteria

- Rendered `/` text contains no unaccented pt words (nao, voce, proximo,
  mes, preco, revisao...) and all é/crase phrases read correctly.
- Rendered `/en-us/` text contains no Portuguese (no ã/õ/ç/á... and no pt
  words), except brand/legal identity (Flow Me, LGPD, CNPJ line, company
  name where intended).
- `#revisao` anchor and nav still work; no console errors; no horizontal
  overflow at 390/768/1024/1440.
- curl shows `Cache-Control: no-cache, must-revalidate` on `/`,
  `/styles.css` and `/landing.js` in production after deploy.

## Test Plan

- Playwright: dump `document.body.innerText` for `/` and `/en-us/`; grep
  pt residuals on pt and pt leaks on en. Viewport sweep for overflow and
  console errors. Screenshot sanity on hero/pricing/footer.

## QA Notes

- 2026-07-10: Playwright innerText audit — `/` has zero unaccented pt
  residuals (52-word scan list) and `/en-us/` has zero Portuguese leaks
  (accented chars + pt word scan), keeping brand/legal identity intact.
- 2026-07-10: Viewport sweep OK on `/` at 390/768/1024/1440 plus `/pt-br/`
  and `/en-us/` at 1440 and `/en-us/` at 390: no console errors, no
  horizontal overflow; nav "Revisão/Review", plan ribbon and urgency banner
  localized. `<time>`/`<svg>` children survive localization via the new
  text-node-preserving helpers.
- Fixes surfaced by the audit: capitalized "Começar"/"Precisão"/"Segurança"
  missing from the word map, "versão" in one static testimonial and in the
  pt dict, plan ribbon not wired, and the leak set (hero chat, ticker,
  proof stats, testimonials heading, plan features/tabs, footer) now wired.
- Cache verified locally: assets referenced as `?v=20260709-locale-cache`;
  nginx header change ships with this deploy (verify Cache-Control in prod
  with curl -I after the workflow finishes).

## Rollback Note

Revert this spec plus the matching `index.html`, `landing.js`, `nginx.conf`
and locale loader hunks. Copy-only + headers; no structural changes.
