# Temporary direct checkout without LP lead gate

## Goal

Run a low-friction paid traffic test where prices are visible immediately and the LP sends buyers directly to checkout. Lead capture is temporarily disabled on the LP to test the impulse-purchase thesis.

## Surface

- `flowme-lp/public/index.html`
  - Pricing card starts in the unlocked state.
  - Plan CTA copy moves from "unlock price" to "subscribe now".
- `flowme-lp/public/landing.js`
  - `setupLeadGate` operates in direct-checkout mode.
  - Plan buttons redirect to checkout with interval and tracking params, without opening the lead modal.
  - Existing lead form code remains in place for rollback.
- `flowme-app/app/checkout/page.tsx`
  - Public checkout collects email on the checkout page when no LP lead is present.
  - Card/Pix checkout can start without `lead_token` if the buyer provides email.
- `flowme-app/app/api/billing/public-checkout/route.ts`
  - API accepts a temporary direct checkout path with `customer_email`.
  - Public checkout sessions keep `lead_id` null and metadata includes `direct_checkout: true`.

## Acceptance criteria

- LP prices are visible on initial page load.
- Clicking monthly/annual CTAs goes to `app.flow-me.online/checkout` directly.
- Checkout does not show "Abra este checkout pela página de oferta" for direct LP visitors.
- Checkout requires email before card/Pix creation.
- Existing signed-lead checkout still works.
- Meta/Clarity tracking params still pass through the checkout URL.

## Test plan

- Local browser smoke at 390x844 and 1440x900:
  - Pricing cards are unlocked.
  - CTA redirects with `direct_checkout=1`, `interval`, `external_id`, `_fbp/_fbc` when available.
- `npm --prefix flowme-app test -- --runInBand __tests__/api/public-checkout.test.ts`
- `npm --prefix flowme-app run build`

## Rollback

Revert this spec and the matching LP/checkout/API changes. The original lead modal and signed lead token flow are preserved so rollback is a code revert, not a schema change.
