# Billing Operations Runbook

## Deployment configuration

Billing configuration is sourced from your deployment environment. Keep credentials in your own secret manager or an untracked `.env.production` on the host. Mobile variables are optional until a native client is enabled; before launch, configure every variable listed in `mobile-integration-contract.md`.

Set `BILLING_ADMIN_USER_IDS` to a comma-separated allowlist of Supabase user UUIDs. Set `DAILY_AI_COST_ALERT_USD` to the daily per-user warning threshold. Secrets containing PEM or JSON data must be base64 encoded as one line.

Billing notifications always create an in-app alert. Browser delivery additionally requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. Native delivery requires `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, and `APNS_BUNDLE_ID` for iOS, or `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY` for Android. Missing optional channel credentials do not prevent the in-app alert.

Stripe webhooks do not wait for notification providers. `flowme-cron` calls `GET /api/cron/deliver-billing-notifications` every minute, claims pending notifications with a lease, skips channels already delivered, and retries transient channel failures up to five attempts with bounded exponential backoff.

Pro remains unlimited in ordinary UX. Provider-protection guardrails are configured through the `BALYS_PRO_*` variables in `.env.production.example`: per-minute requests, expensive-job concurrency, lease duration, and workload-specific rolling 24-hour limits. Reaching a guardrail returns a retry-later response and opens an admin alert; it does not downgrade the subscription or expose a Pro credit balance.

## Scheduled reconciliation

`flowme-cron` calls `GET /api/cron/reconcile-billing` once per day at 04:00 UTC with `Authorization: Bearer $CRON_SECRET`. The job:

1. Reads every non-Free local subscription.
2. Retrieves authoritative state from Stripe, Apple, or Google.
3. Repairs local subscription and entitlement state when it differs.
4. Persists a run summary and mismatch issues.
5. Opens an alert when provider verification fails.
6. Aggregates today's AI cost and opens threshold alerts.

The endpoint is safe to call manually from an authorized environment. Do not run multiple copies concurrently during incident response.

## Dashboard

Allowlisted users can open `/app/admin/billing`. It shows recent alerts, reconciliation runs, cancellation requests, and per-user AI cost for the last 30 days. Raw provider payloads and secrets are intentionally absent.

## Alert response

`webhook_failure`: confirm provider endpoint health and credentials, inspect application logs for the timestamp, then run reconciliation after fixing the cause.

`subscription_mismatch`: verify provider availability and account binding. Reconciliation repairs known state differences automatically; repeated critical alerts indicate invalid credentials, missing transactions, or a broken store contract.

`high_ai_cost`: inspect the user's AI usage categories and provider costs. Apply abuse controls only when usage is clearly abnormal; Pro remains unlimited in ordinary user-facing UX.

`cancellation_request`: review the support context and respond before changing subscription state. Apple/Google users may still cancel immediately in their store.

`payment_failure`: confirm the subscription state and notification delivery attempts. Stripe recovery through `invoice.paid` resolves open payment-failure alerts and removes the user's in-app warning.

## Webhook checks

- Stripe must verify the raw request body with `STRIPE_WEBHOOK_SECRET` and deduplicate provider event IDs.
- Apple must verify both signed JWS payloads and deduplicate `notificationUUID`.
- Google Pub/Sub must present the configured bearer token; the backend deduplicates `messageId` and fetches current state instead of trusting notification type alone.
- A provider should receive `2xx` for duplicate or irrelevant events and a retryable failure only when processing genuinely failed.

For a local Stripe end-to-end check, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, copy its temporary signing secret into `STRIPE_WEBHOOK_SECRET`, and use Stripe test mode to complete Checkout. Verify `checkout.session.completed`, `invoice.payment_failed`, and `invoice.paid` in `billing_events`, then confirm the user entitlement and billing alert states. Never use production payment details for this check.

## Incident sequence

1. Preserve the failed event ID and timestamp; never paste secrets or full receipts into tickets.
2. Check `/app/admin/billing`, application logs, provider status, and the latest reconciliation run.
3. Correct credentials through GitHub Secrets/Variables and deploy through CI/CD.
4. Trigger reconciliation and confirm entitlements match provider state.
5. Resolve the alert only after the affected user state is verified.
