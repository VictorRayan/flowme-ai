---
name: asaas-billing
description: Implement and review Asaas billing integrations for customers, Pix charges, recurring subscriptions, QR codes, webhooks, idempotency, and normalized entitlement state. Use whenever changing Asaas API requests, checkout behavior, payment confirmation, recurrence, webhook security, or provider mapping in Flow Me.
---

# Asaas Billing

## Workflow

1. Read `references/contracts.md` completely before changing Asaas behavior.
2. Keep Asaas HTTP types and raw statuses inside the Asaas adapter.
3. Resolve the selected gateway through the billing provider registry; never branch on Asaas in entitlement code.
4. Persist a checkout attempt before calling Asaas and use its opaque ID as `externalReference`.
5. Reuse the stored Asaas customer ID. Never create a duplicate customer on every retry.
6. For Pix subscriptions, create the subscription, retrieve its first payment, then retrieve that payment's QR code.
7. Grant Pro only after an authenticated, idempotently claimed `PAYMENT_RECEIVED` event.
8. Return HTTP 200 quickly for valid webhook deliveries and tolerate unknown JSON fields and event types.
9. Test duplicate delivery, invalid token, out-of-order events, overdue, refund, deletion, and renewal.

## Hard Rules

- Authenticate API requests with `access_token`; never expose the API key to the browser or logs.
- Validate webhook `asaas-access-token` with constant-time comparison.
- Treat webhook delivery as at least once. The Asaas event `id` is the idempotency key.
- Do not treat `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, redirects, QR display, or client polling as proof of payment.
- For Pix, only `PAYMENT_RECEIVED` grants or renews access.
- `PAYMENT_OVERDUE` moves access to the configured delinquency state; refund, deletion, or chargeback revokes according to domain policy.
- A Pix subscription schedules independent Pix charges. It is not automatic debit unless Pix Automático is explicitly implemented.
- Existing subscriptions stay owned by their original provider when routing changes. Provider switching applies to new checkouts unless a migration flow is explicitly built.
- GET requests to Asaas have no request body.
- Parsers allow additional response attributes.

## Review Checklist

- Provider secrets remain server-only and `.env` examples contain placeholders only.
- Customer CPF/CNPJ is normalized and never persisted in checkout metadata or logs unless a dedicated encrypted field is approved.
- Checkout attempt, provider customer, subscription, and payment identifiers are correlated without trusting browser-supplied IDs.
- Webhook processing is replay-safe and newer terminal state cannot be overwritten by an older event.
- Entitlements are computed from normalized subscription state, never directly from an Asaas payload.
- Sandbox contract tests and signed webhook fixtures cover first payment and at least one renewal.
