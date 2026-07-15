# Google Analytics subdomain tracking

Date: 2026-07-15

## Goal

Install the Google Analytics 4 tag on both the static landing page and the
authenticated app/checkout so paid traffic can be analyzed across:

- `flow-me.online`
- `app.flow-me.online`

## Surface

- `public/index.html`: static landing page tag.
- `../flowme-app/app/layout.tsx`: app-wide analytics installation.
- `../flowme-app/components/GoogleAnalytics.tsx`: client-side route pageviews.

## UX intent

No visible UI changes. The tag must not block first paint or alter the direct
checkout experiment.

## Tracking behavior

- Use the same GA4 measurement ID on LP and app: `G-942EZBWS43`.
- Configure the cookie domain as `flow-me.online` only on production
  subdomains; fall back to `auto` locally.
- Configure linker domains for `flow-me.online` and `app.flow-me.online`.
- In the Next.js app, track initial pageview plus client route changes.

## Acceptance criteria

- LP loads the Google tag asynchronously.
- App loads Google tag after hydration/interaction through Next.js Script.
- Checkout pages under `app.flow-me.online/checkout` are tagged.
- No lead-capture or checkout behavior changes.
- Local build passes.

## Validation plan

- `node --check flowme-lp/public/landing.js`
- `npm --prefix flowme-app run build`
- Inspect generated markup/scripts for the measurement ID.
- In production after deploy, verify in GA4 Realtime and DebugView.

## Cross-subdomain note

Google Analytics cross-domain measurement is primarily for different root
domains. Flow Me currently uses subdomains under the same root domain, so the
same tag ID and a shared root cookie domain should keep the journey together.
The linker domain configuration is still included as a defensive setting.

## Rollback

Remove the GA script block from `public/index.html`, remove the app component
from `app/layout.tsx`, and delete `components/GoogleAnalytics.tsx`.
