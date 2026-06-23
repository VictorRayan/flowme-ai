# Checkout V2 Implementation Plan

## Approval Gate

Status: **approved and implemented in code on 2026-06-23; production rollout awaits `IPINFO_TOKEN` and live sandbox/contract validation**.

This document is the review contract. No application, API, provider, infrastructure, or agent-instruction change described below is authorized merely by the existence of this plan.

## Objective

Replace the current provider-panel replacement flow with a persistent, mobile-first payment surface. Card data goes directly from Stripe.js in the browser to Stripe using the publishable key. Stripe returns an opaque `PaymentMethod` identifier; Flow Me sends only that identifier to its backend. Pix remains an Asaas flow and is offered only when server-side IP geolocation resolves the customer to Brazil.

This is not Stripe Checkout embedded in the page and does not use the Payment Element. It uses the individual Stripe.js card field Elements only as isolated PCI-safe inputs. Flow Me code never reads the raw number, expiry, or CVC.

## Non-negotiable Requirements

- [x] The Pix/Card switch remains visible before, during, and after either payment form is initialized.
- [x] Pix is available only when the server resolves the request IP to country code `BR`.
- [x] Card is available in every country supported by the configured Stripe account and price.
- [x] Card fields render immediately from Stripe.js without waiting for checkout/session creation.
- [x] Flow Me never renders raw PAN/CVC inputs, reads raw card values, sends raw card data to its API, or stores card data.
- [x] Stripe.js, initialized only with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, sends card data directly from the browser to Stripe and creates a `PaymentMethod`; the Flow Me API receives only the opaque `pm_...` identifier.
- [x] Stripe creates the recurring subscription with `payment_behavior=default_incomplete`; the browser completes SCA/3DS with the returned client secret when required.
- [x] Pro access is granted only by the idempotent `invoice.paid` webhook path.
- [x] Product content and all checkout copy use the saved Flow Me interface language (`pt-BR` or `en-US`).
- [x] Tablet and mobile layouts show the complete product and payment content without clipping or horizontal overflow.
- [x] The checkout has an explicit vertical scroll container inside the application shell on every viewport.
- [x] Browser E2E covers Brazil/non-Brazil routing, persistent method switching, card-field visibility, tablet layout, and mobile scroll reachability.

## Architecture

### Persistent Checkout Shell

`/app/checkout` owns three stable regions:

1. Localized product summary.
2. Persistent payment-method switch.
3. Provider panel whose content changes without replacing the switch.

The card panel remains mounted when the user visits Pix and returns to card so Stripe.js initialization and typed state are not needlessly repeated. The Pix panel can show payer fields, QR code, pending confirmation, or an error while the switch remains accessible.

### Card Tokenization and Subscription Flow

1. Load Stripe.js once in the browser from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. The secret key is never shipped to the client.
2. Mount `CardNumberElement`, `CardExpiryElement`, and `CardCvcElement` immediately. These are isolated Stripe-hosted field Elements, not an embedded Stripe Checkout Session or Payment Element.
3. On submit, call `stripe.createPaymentMethod({ type: 'card', card: cardNumberElement, billing_details })` in the browser. Stripe.js sends PAN, expiry, and CVC directly to Stripe.
4. Stripe.js returns a `PaymentMethod` object to the browser. Send only `paymentMethod.id` (`pm_...`), plan, interval, and locale to `POST /api/billing/checkout`. Do not send a browser-asserted country as authorization.
5. Persist `billing_checkout_attempts` before calling the provider adapter.
6. The Stripe adapter reuses/creates the Customer, attaches the PaymentMethod, and creates a subscription using the configured Price ID, `default_incomplete`, and `save_default_payment_method=on_subscription`.
7. Return normalized identifiers and the first invoice confirmation client secret. Never return provider secrets.
8. When a confirmation secret exists, call `stripe.confirmCardPayment()` in the browser for SCA/3DS. That confirmation is also browser-to-Stripe; Flow Me never handles the authentication data.
9. Show a localized pending state and poll only the normalized checkout-attempt endpoint.
10. Mark the attempt paid and grant Pro only after `invoice.paid` is durably processed.

Retries must create a new attempt. A failed/incomplete subscription must not be silently reused as proof of access. Duplicate submit is prevented in the browser and correlated by the attempt metadata in Stripe.

### Pix Country Eligibility by IP

Create `GET /api/billing/market`:

- Read the client IP from the right-most trusted Traefik forwarding value, never from a browser-supplied country field.
- Normalize IPv4, IPv6, and IPv4-mapped IPv6; reject private/reserved addresses in production lookups.
- Resolve the ISO country through an `IpCountryResolver` adapter backed initially by the IPinfo Lite API. `IPINFO_TOKEN` is a server-only GitHub Environment secret and the API base URL is configurable.
- Use a short timeout, one bounded retry, and a bounded in-memory country cache. Never place IPinfo on the critical path for card rendering or card submission.
- Return only `{ countryCode, pixAvailable }`; do not return or persist the IP.
- Fail closed for Pix: timeout, malformed response, unavailable provider, or unknown country means `pixAvailable=false`; card remains available.
- Revalidate Pix eligibility inside `POST /api/billing/checkout`; client visibility is not authorization.
- Make the geolocation base URL/provider configurable so it can be replaced without touching billing-domain code.
- Add rate limiting and avoid logging full client IPs.

The earlier browser-locale/timezone heuristic must be removed. Language and market are independent.

If IPinfo is unavailable or the token is missing, the safe fallback is Card-only. Do not infer Brazil from Portuguese, BRL, CPF entry, timezone, or a client-provided country.

### Provider Boundary

- `BillingGateway` remains the provider port.
- Stripe-specific PaymentMethod, subscription, invoice confirmation, and raw status types stay inside the Stripe adapter.
- Asaas customer, Pix subscription, payment, and QR types stay inside the Asaas adapter.
- The checkout API maps both adapters to discriminated normalized responses.
- Entitlements consume normalized subscription state only.

## Responsive Layout

### Mobile: 320-599 px

- One column: compact product summary, interval selector, persistent payment switch, then active form.
- Checkout page owns `height: 100%`, `min-height: 0`, and `overflow-y: auto` inside the app shell.
- Use bottom padding that keeps the final CTA reachable above browser safe areas.
- Headline uses responsive typography and never forces horizontal overflow.
- Feature rows align to the top and wrap naturally.
- Payment controls are at least 44 px high; Card Elements use full width.

### Tablet: 600-1199 px

- Use one column through the medium breakpoint unless both columns have enough measured width.
- Two-column layout starts at `lg`, not `md`.
- Product summary has no fixed height or clipping; all descriptions and features remain visible.
- Payment panel follows immediately after the summary and remains in normal document flow.

### Desktop: 1200 px and above

- Two flexible columns with `minmax(0, 1fr)` and a sticky payment panel only when viewport height permits.
- Sticky behavior must not create nested scroll traps.

## Repository Instruction Updates

After approval, update `flowme-app/AGENTS.md`, `flowme-app/GEMINI.md`, and `flowme-app/CLAUDE.md` with the same enforceable rules:

- Mobile-first implementation is mandatory, not optional polish.
- Canonical validation viewports are 390x844, 768x1024, 1024x768, and 1440x900.
- Fixed-height app shells require an explicit page scroll owner using `min-height: 0` and `overflow-y: auto`.
- Material UI work requires Playwright checks for content visibility, CTA reachability, and horizontal overflow at mobile, tablet, and desktop sizes.
- A desktop-only screenshot or successful TypeScript build is not sufficient evidence for responsive completion.

## Localized UX States

Both languages must cover:

- Loading market and catalog.
- Card fields ready, tokenizing, creating subscription, awaiting 3DS, awaiting webhook, paid, declined, retryable provider error.
- Pix unavailable outside Brazil.
- Pix payer validation, QR ready, expired QR, awaiting payment, paid, and provider error.
- Country lookup unavailable while card remains usable.

Provider names and raw provider messages remain hidden from end users. Safe error codes and provider request IDs may be logged server-side.

## Test Strategy

### Unit and API

- Stripe adapter uses the configured Price ID, attaches only a `pm_...` identifier, creates `default_incomplete`, returns the expanded invoice confirmation secret, and preserves attempt metadata.
- Reject malformed/non-Stripe PaymentMethod identifiers before provider calls.
- `invoice.paid` remains the only card activation event.
- IP parsing ignores spoofable left-most forwarded values and covers IPv4/IPv6/private addresses.
- Country resolver covers BR, non-BR, timeout, provider failure, malformed payload, and cache expiry.
- Checkout API rejects Pix unless the server-resolved market is BR.
- Locale and provider presentation remain independent.

### Playwright E2E

Add `e2e/checkout.spec.ts` and projects for:

- Desktop Chrome: 1440x900.
- Tablet: 768x1024.
- Mobile: 390x844.

Scenarios:

- BR market shows Pix and Card; switching repeatedly keeps the switch visible.
- Non-BR market hides Pix and Card remains usable.
- Card fields become visible without a checkout POST.
- Submitting card sends only a PaymentMethod identifier in the mocked API payload.
- Tablet shows full localized description, all features, interval selector, and payment panel.
- Mobile can scroll from the heading to every field and final CTA; no horizontal overflow.
- `pt-BR` and `en-US` each render one consistent language.
- Visual screenshots at the three canonical viewports are retained for regression review.

Real Stripe test-mode contract tests run separately from deterministic UI E2E and use Stripe test PaymentMethods. Production card data is never used in automation.

## Official Stripe Contracts Consulted

- [Create a PaymentMethod with Stripe.js and Elements](https://docs.stripe.com/js/payment_methods/create_payment_method): browser-side creation of the tokenized PaymentMethod.
- [Build a subscriptions integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=elements): incomplete subscription creation, first-invoice confirmation, and client-side payment confirmation.
- [Stripe integration security guide](https://docs.stripe.com/security/guide): PCI boundaries and the rule that sensitive card data must not pass through Flow Me servers.
- [Stripe payment integration options](https://docs.stripe.com/payments/payment-methods/integration-options): distinction between hosted Checkout, embedded payment UI, and custom Stripe.js Elements integrations.

Decision derived from those contracts: use `PaymentMethod` IDs rather than the legacy Token API for the new subscription flow. “Tokenized card” in this plan means the opaque Stripe `pm_...` identifier returned by Stripe.js; it never means serializing raw card fields into a Flow Me request.

## Delivery Sequence

1. Add country resolver/market endpoint and tests.
2. Update the three repository instruction files with the approved mobile-first contract.
3. Extend normalized provider contracts for tokenized card subscription results.
4. Replace Checkout Elements with split Card Elements and Stripe.js PaymentMethod creation.
5. Add server-side subscription creation and SCA response mapping.
6. Restructure the page so the switch is persistent and provider panels do not replace it.
7. Fix app-shell/checkout scrolling and change the two-column breakpoint to `lg`.
8. Complete bilingual states and accessible labels.
9. Add Playwright viewport projects and checkout E2E.
10. Run unit/API tests, build, E2E, Stripe test-mode contract test, and Asaas sandbox Pix test.
11. Deploy through GitHub Actions and verify both BR and non-BR production paths.

## Definition of Done

- [x] All non-negotiable requirements are demonstrated by automated tests.
- [x] No Checkout Elements, Payment Element, custom PAN/CVC input, or raw card API payload remains.
- [x] Pix eligibility is based on server-side IP country, not locale, timezone, or client claims.
- [x] No clipped content or scroll trap at 390x844, 768x1024, 1024x768, or 1440x900.
- [ ] Stripe test card completes normal and 3DS subscription flows; Asaas sandbox Pix completes first payment confirmation.
- [x] `npm test`, `npm run build`, and `npm run test:e2e -- e2e/checkout.spec.ts` pass.
- [ ] GitHub Actions deploy and production smoke checks pass.
