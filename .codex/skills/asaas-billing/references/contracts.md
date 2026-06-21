# Asaas Billing Contracts

Verified against the official Asaas v3 documentation on 2026-06-21.

## Environments and Authentication

- Sandbox base URL: `https://api-sandbox.asaas.com/v3`
- Production base URL: `https://api.asaas.com/v3`
- API header: `access_token: <api-key>`
- Webhook authentication header: `asaas-access-token: <configured-token>`
- Keep API keys server-side. GET requests must not contain a body.

Official references:

- https://docs.asaas.com/docs/authentication-2
- https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint

## Customer Contract

Create with `POST /customers`. The minimum Flow Me payload is `name`, `cpfCnpj`, `email`, `externalReference`, and `notificationDisabled`. Store and reuse the returned `cus_...` ID because Asaas allows duplicate customers.

Reference: https://docs.asaas.com/reference/create-new-customer

## Pix Subscription Contract

Create with `POST /subscriptions` using:

- `customer`: stored Asaas customer ID
- `billingType`: `PIX`
- `nextDueDate`: first due date in `YYYY-MM-DD`
- `value`: BRL amount as decimal currency units
- `cycle`: `MONTHLY` or `YEARLY`
- `description`: localized catalog description
- `externalReference`: opaque Flow Me checkout attempt ID

The subscription is a scheduler. Each cycle creates a separate Pix charge. Retrieve charges with `GET /subscriptions/{id}/payments`; retrieve the dynamic QR with `GET /payments/{paymentId}/pixQrCode`. The QR response contains a Base64 image, copy-and-paste payload, and expiration.

References:

- https://docs.asaas.com/docs/creating-a-subscription
- https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix

## Payment Webhook Contract

Webhook payloads contain an event ID, event name, and complete `payment` object. Subscription-generated payments contain `payment.subscription`; `payment.externalReference` is used for internal correlation.

| Asaas event | Normalized meaning | Entitlement action |
|---|---|---|
| `PAYMENT_CREATED` | awaiting payment | none |
| `PAYMENT_RECEIVED` | settled | activate or renew Pro |
| `PAYMENT_OVERDUE` | delinquent | apply past-due policy |
| `PAYMENT_REFUNDED` | reversed | revoke paid period |
| `PAYMENT_DELETED` | canceled charge | do not grant; revoke if it was active |
| chargeback events | disputed/reversed | revoke or hold access |

Do not use `PAYMENT_CONFIRMED` as final Pix settlement. Asaas documents a precautionary-block case where Pix can remain confirmed for up to 72 hours and later become received or refunded.

References:

- https://docs.asaas.com/docs/payment-events
- https://docs.asaas.com/docs/subscriptions

## Delivery and Idempotency

- Delivery is at least once; duplicate events are expected.
- Claim the event ID with a unique `(provider, event_id)` constraint before effects.
- Respond with HTTP 200 after a valid event has been durably accepted.
- Asaas pauses a queue after 15 consecutive non-200 responses and retains events for 14 days.
- Accept new or unknown JSON attributes without failing.

References:

- https://docs.asaas.com/docs/about-webhooks
- https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint
