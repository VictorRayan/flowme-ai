# LP performance, Clarity and cache optimization

## Goal

Improve paid-traffic landing performance and session replay reliability without changing the visual offer. The target is lower LCP/INP risk on `flow-me.online`, better repeat-load behavior, and more stable Clarity stitching between the LP and checkout.

## Surface

- `public/index.html`
  - Bump CSS/JS cache-bust query to `20260715-perf`.
  - Reduce the Google Fonts request to the Poppins weights used for the main UI.
  - Delay Microsoft Clarity loading until browser idle with a timeout fallback.
  - Identify Clarity sessions with the existing non-PII Flow Me visitor id.
- `public/landing.js`
  - Defer non-critical animation/bootstrap work until after first paint/idle.
  - Reduce and throttle the global canvas background workload.
  - Pause canvas rendering while the tab is hidden.
- `nginx.conf`
  - Enable gzip for HTML/CSS/JS/SVG/JSON/XML text payloads.
  - Keep HTML/legal routes revalidated on every deploy.
  - Serve static assets with one-year immutable cache headers.
- `../flowme-app/app/layout.tsx`
  - Delay app/checkout Clarity loading until idle.
  - Identify Clarity with URL `external_id`, stored Meta external id, `_fbp`, or a local anonymous id; never with PII.

## Acceptance criteria

- LP HTML still revalidates so new deploys are visible.
- CSS/JS/images/SVG icons are cacheable with long-lived immutable headers.
- Gzip is enabled in the LP Nginx image for text assets.
- Clarity still loads project `xkzkqxbqku` on LP and app.
- Clarity receives only non-PII identifiers.
- First-paint critical copy and CTAs remain visible before delayed animations initialize.
- Canvas background does not render at full speed while the tab is hidden and runs at a throttled frame rate.

## Test plan

- Static grep checks for `20260715-perf`, delayed Clarity snippet and gzip config.
- Validate Nginx syntax in the Docker image or production deploy.
- Browser QA at 390x844 and 1440x900:
  - First viewport shows hero copy, CTA and WhatsApp proof.
  - Delayed background appears without hiding text.
  - Lead gate and checkout link still work.
  - No console errors.
- Post-deploy curl:
  - `/` returns `Cache-Control: no-cache, must-revalidate`.
  - `/styles.css?v=20260715-perf` and `/landing.js?v=20260715-perf` return `Cache-Control: public, max-age=31536000, immutable`.
  - CSS/JS responses with `Accept-Encoding: gzip` return compressed content.

## Regression risks

- Delaying Clarity can miss a small number of ultra-short bounced sessions.
- Long-lived asset cache requires cache-bust query changes on future CSS/JS changes.
- Delaying hero chat animation can briefly show the static non-sequenced chat state.
- Nginx `add_header` inheritance is fragile; security headers must be preserved in locations that set cache headers.

## Rollback

Revert this spec plus matching changes in `public/index.html`, `public/landing.js`, `nginx.conf` and `../flowme-app/app/layout.tsx`. Restore the previous Clarity snippets and `20260709-locale-cache` asset query if needed.
