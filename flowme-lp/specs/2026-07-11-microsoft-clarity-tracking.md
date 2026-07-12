# Microsoft Clarity tracking

## Goal

Install Microsoft Clarity on the public landing page so acquisition sessions can be inspected together with the checkout flow on `app.flow-me.online`.

## Surface

- `public/index.html`: Clarity snippet in `<head>` for the main LP.
- `../flowme-app/app/layout.tsx`: matching Clarity project snippet for app and checkout pages.
- `../flowme-app/app/checkout/page.tsx`: explicit masking for checkout PII/payment surfaces.
- `../flowme-app/app/app/checkout/page.tsx`: explicit masking for logged-in checkout PII/payment surfaces.

## Acceptance criteria

- LP loads Clarity project `xkzkqxbqku`.
- App and checkout load the same Clarity project.
- Public checkout sensitive fields and displayed contact/payment data are explicitly masked with `data-clarity-mask`.
- Existing Meta Pixel tracking remains unchanged.
- No visual layout changes on the LP.

## Test plan

- Inspect LP HTML for `https://www.clarity.ms/tag/xkzkqxbqku`.
- Build the Next.js app to verify the root layout and checkout pages compile.
- Confirm no secrets are added to git; Clarity project id is public by design.

## Rollback

Remove the Clarity script from `public/index.html`, remove the `microsoft-clarity` `Script` from the app root layout, and keep the checkout masking attributes if session replay remains installed through another provider.
