# Pricing Urgency Trigger

## Goal

Add a strong anticipation trigger to `#planos` between the section heading
and the plan cards: AI in the routine is no longer the future; whoever does
not apply it falls behind — being 2x more productive is survival.

## Surface

- `public/index.html`: `.pricing-urgency` banner (⚡ icon + bold lead +
  supporting line).
- `public/styles.css`: orange-accent banner with a soft pulsing glow
  (disabled under `prefers-reduced-motion`), stacked layout under 620px.
- `public/landing.js`: `pricingUrgencyStrong` / `pricingUrgencyText` locale
  keys (pt-br/en-us) wired in `applyLocale`.

## Copy

- pt: "Isso nao e mais coisa do futuro." + "Quem nao colocar IA na rotina
  vai ficar para tras: hoje, ser 2x mais produtivo nao e vantagem, e
  sobrevivencia."
- en: "This is not the future anymore." + "If you don't put AI into your
  routine, you fall behind: today, being 2x more productive isn't an edge,
  it's survival."

## QA Notes

- 2026-07-09: Playwright headless on `/` at 1440x900 and 390x844 plus
  `/en-us/` at 1440x900: banner renders between heading and plan cards with
  localized copy, no console errors, no horizontal overflow. Screenshots
  reviewed on desktop and mobile; pricing reveal flow unchanged (locked
  prices still blurred, CTA still opens the unlock form).

## Rollback Note

Remove the `.pricing-urgency` block from `index.html`, its CSS and the two
locale keys; the pricing section returns to its previous shape.
