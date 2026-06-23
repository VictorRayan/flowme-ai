# Subscription, Credits, Billing, and Support Implementation Plan

## Decision Summary

- [x] Billing is gateway-independent: catalog, checkout attempts, normalized subscriptions, and entitlements do not depend on Stripe or Asaas payloads.
- [x] Transparent web checkout uses Stripe Elements for card, Apple Pay, and Google Pay, and Asaas for Pix.
- [x] Product name, description, checkout copy, and feature highlights are stored in the database for `pt-BR` and `en-US`.
- [x] Gateway routing is data-driven per payment method and can change for new checkouts without moving or breaking existing subscriptions.
- [x] Web app plans:
  - Free: access only to Notes and BalysAI.
  - Pro: access to everything.
- [x] Free AI usage is limited by daily AI credits, not raw tokens.
- [x] Pro has unlimited AI credits from the user's point of view, with internal fair-use and abuse protection.
- [x] Pro web pricing:
  - Monthly: R$59,90/month.
  - Annual: R$39,90/month billed annually, equivalent to R$478,80/year.
- [x] Web payments use Stripe Checkout + Stripe Billing + Stripe Customer Portal.
- [x] Mobile app will use Free entry + mandatory Google sign-in + native IAP:
  - iOS: App Store In-App Purchase.
  - Android: Google Play Billing.
- [x] Backend entitlements are shared across web, iOS, and Android so the user has one subscription state.
- [x] Payment failures from Stripe trigger in-app, push, and WhatsApp notifications when channels are available.
- [x] Mobile push notifications use APNs on iOS and FCM on Android as delivery transports only.
- [x] Do not use Firebase as application backend, datastore, auth provider, or Cloud Functions layer for push.
- [x] Apple/Google IAP billing-state changes are handled through store server notifications and backend reconciliation.
- [x] Add a Support section guided by Balys with product knowledge, quick questions, and a cancellation request funnel.

## Product Principles

- [x] The user should understand usage in plain language.
- [x] Never expose token counts as the main concept.
- [x] Use "AI credits" as a simple daily allowance for Free.
- [x] Show upgrade CTAs at the moment of intent, not only in a pricing page.
- [x] Avoid dead ends: every locked feature should explain why it is locked and what Pro unlocks.
- [x] Keep Free valuable enough to prove the product:
  - Notes.
  - Limited BalysAI.
  - Clear upgrade path.
- [x] Keep Pro simple:
  - All product surfaces.
  - Unlimited AI credits.
  - Premium channels and automations.

## Plan Definitions

### Free

- [x] Accessible features:
  - Notes.
  - BalysAI with daily AI credits.
  - Account/profile/settings.
  - Billing/pricing/support.
- [x] Locked features:
  - Calendar and Today execution flows.
  - Goals and operating plans.
  - Finance dashboard and financial AI review.
  - Weekly Review and Monthly Review.
  - Connectors.
  - WhatsApp channel.
  - Daily briefings.
  - Reminders.
  - Meeting recording/transcription.
  - Image generation, unless we choose to allow a tiny sample allowance.
- [x] Free daily AI credits reset every day in the user's timezone.
- [x] Free AI credit display should be understandable:
  - Example: "Você tem 3 de 5 créditos de IA hoje."
  - Avoid: "Você usou 12.830 tokens."
- [x] Initial Free allowance:
  - 5 AI credits/day.
  - Simple Balys text answer: 1 credit.
  - Tool action: 2-4 credits depending on cost.
  - Web search/grounded answer: locked or 4 credits.
  - Council/reviews/images/meetings: Pro only.

### Pro

- [x] Accessible features:
  - Everything.
  - BalysAI.
  - Notes.
  - Calendar and Today.
  - Goals and operating plans.
  - Finance management and dashboard.
  - Weekly and Monthly Review.
  - Connectors.
  - WhatsApp channel.
  - Daily briefings.
  - Reminders.
  - Meeting recording/transcription.
  - Image generation.
  - Support guided by Balys.
- [x] Pricing:
  - Monthly: R$59,90.
  - Annual: R$478,80/year.
- [x] Pro UI copy:
  - "Créditos de IA ilimitados no Pro."
  - Internally still enforce abuse protection, provider outage protection, and extreme usage review.
- [x] Internal fair-use guardrails:
  - [x] Per-minute request throttling.
  - [x] Rolling 24-hour high-cost job caps for provider protection.
  - [x] Expensive-job concurrency leases with automatic expiration.
  - [x] Admin alert if one user exceeds expected cost thresholds.
  - Never show "fair use" as ordinary UX unless the account is clearly abusive or provider-limited.
  - Status: complete for Balys web, Balys WhatsApp, and meeting processing; scheduled reviews/briefings already have deterministic schedule frequency.
  - Implemented design:
    - Keep Pro user-facing credits unlimited; guardrails protect reliability and provider spend rather than creating a hidden ordinary quota.
    - Apply short-window per-user throttling to Balys channels, plus concurrency leases for expensive jobs.
    - Apply configurable rolling 24-hour caps for images, meetings, grounded searches, Council/reviews, and other high-cost workloads.
    - Keep thresholds in configuration or plan policy rather than scattering numeric limits through routes.
    - Return a friendly retry-later/provider-protection response when a guardrail is reached and create an admin alert.
    - Ensure ordinary Pro use never displays an AI-credit balance or a misleading "limit reached" message.

## AI Credit Model

### User-Facing Model

- [x] Use "credits" as the user concept.
- [x] Show Free daily allowance in a small Balys header indicator:
  - "8 créditos hoje."
  - Warning state at 20% remaining.
  - Empty state at 0 credits.
- [x] Show a friendly explanation:
  - "Créditos medem o uso de IA. Perguntas simples usam pouco; ações com busca, arquivos ou análise usam mais."
- [x] Do not show token counts by default.
- Optional later: add "Ver detalhes" with human-readable categories if users need more transparency.

### Internal Cost Mapping

- [x] Add `ai_credit_events` table:
  - `id`
  - `user_id`
  - `source`: `chat`, `tool`, `briefing`, `review`, `image`, `meeting`, `support`
  - `feature_key`
  - `credits`
  - `provider`
  - `model`
  - `estimated_input_tokens`
  - `estimated_output_tokens`
  - `actual_input_tokens`
  - `actual_output_tokens`
  - `cost_usd_estimate`
  - `metadata`
  - `created_at`
- [x] Add daily usage query helper:
  - sum credits by `user_id`, local date, source.
- [x] Add plan credit policies in code:
  - Free: 10/day.
  - Pro: unlimited display, internal abuse thresholds.
- [x] Instrument the major AI paths:
  - Balys chat.
  - Context scorer.
  - Tool calls that invoke AI.
  - Image generation.
  - Briefing grounded search.
  - Weekly/monthly review Council.
  - Meeting transcription/summary.
  - Thread summarizer/profile updater.
- [x] Start with estimates where providers do not return usage metadata.
- Follow-up: prefer actual provider usage metadata when available.

### Suggested Credit Costs

- [x] Balys simple answer: 1 credit.
- [x] Balys with one deterministic tool: 2 credits.
- [x] Connector read/analyze: 3 credits.
- [x] Web grounded search: 4 credits.
- [x] Image generation: Pro only.
- [x] Weekly/Monthly Review: Pro only.
- [x] Meeting transcription: Pro only.
- [x] Daily briefing: Pro only.

## Entitlements Architecture

### Database

- [x] Add migration `050_subscription_entitlements.sql`.
- [x] Create `subscription_plans`:
  - `id`
  - `code`: `free`, `pro`
  - `name`
  - `status`
  - `metadata`
- [x] Create `subscription_prices`:
  - `id`
  - `plan_code`
  - `billing_provider`: `stripe`, `apple`, `google`
  - `billing_interval`: `monthly`, `annual`
  - `currency`
  - `amount_cents`
  - `provider_price_id`
  - `provider_product_id`
  - `active`
- [x] Create `user_subscriptions`:
  - `id`
  - `user_id`
  - `plan_code`
  - `billing_provider`
  - `provider_customer_id`
  - `provider_subscription_id`
  - `provider_original_transaction_id`
  - `provider_purchase_token`
  - `status`: `free`, `trialing`, `active`, `past_due`, `grace_period`, `account_hold`, `canceled`, `expired`, `incomplete`
  - `current_period_start`
  - `current_period_end`
  - `cancel_at_period_end`
  - `grace_period_ends_at`
  - `last_payment_failure_at`
  - `last_synced_at`
  - `metadata`
  - `created_at`
  - `updated_at`
- [x] Create `user_entitlements`:
  - `user_id`
  - `plan_code`
  - `has_pro`
  - `billing_state`
  - `access_until`
  - `features`
  - `updated_at`
- [x] Create `billing_events`:
  - `id`
  - `provider`
  - `event_id`
  - `event_type`
  - `user_id`
  - `provider_customer_id`
  - `provider_subscription_id`
  - `payload`
  - `processed_at`
  - unique `(provider, event_id)`
- [x] Create `billing_notifications`:
  - `id`
  - `user_id`
  - `kind`
  - `provider`
  - `status`
  - `channels_attempted`
  - `created_at`
  - `sent_at`

### Entitlement Library

- [x] Add `lib/billing/entitlements.ts`.
- [x] Add `getUserEntitlements(supabase, userId)`.
- [x] Add `isFeatureAllowed(entitlements, featureKey)`.
- [x] Add `requireFeature(supabase, userId, featureKey)`.
- [x] Add `getAiCreditState(userId, timezone)`.
- [x] Add `consumeAiCredits(input)`.
- [x] Synchronize entitlements from normalized provider subscriptions through webhook and reconciliation adapters.
- [x] Feature keys:
  - `notes`
  - `balys_limited`
  - `balys_unlimited`
  - `calendar`
  - `today`
  - `goals`
  - `finance`
  - `reviews`
  - `connectors`
  - `whatsapp`
  - `briefings`
  - `reminders`
  - `meetings`
  - `images`
  - `support`
- [x] Default user without subscription row gets Free entitlements.

## Multi-provider Transparent Checkout

### Product and UX Decisions

- [x] Use a dedicated responsive `/app/checkout` surface with the Flow Me logo, Pro benefits, monthly/annual selector, secure-payment messaging, and an order summary.
- [x] Default to annual and show the real discount against twelve monthly payments: R$718,80 versus R$478,80, saving R$240,00 (33%).
- [x] Render localized product content from `subscription_plan_localizations`, falling back from the requested locale to `pt-BR`.
- [x] Offer Pix through Asaas and card through Stripe. Offer Apple Pay and Google Pay through Stripe Express Checkout only when Stripe reports the wallet as available on the current device/browser.
- [x] “Google Play” in web checkout means Google Pay. Google Play Billing remains exclusive to native Android in-app subscriptions.
- [x] Stripe Elements owns all card and wallet fields. Flow Me never receives raw PAN, CVC, or wallet credentials.
- [x] Pix checkout collects the payer name and CPF/CNPJ, sends it only to the server/Asaas, and does not persist the document in checkout metadata.

### Provider Boundary

- [x] Define a `BillingGateway` port whose checkout result is a discriminated domain response (`stripe_elements` or `pix_qr_code`).
- [x] Implement a provider registry. Routes and UI request a payment method; the orchestrator resolves the active provider route from the database.
- [x] Keep provider identifiers on checkout attempts and normalized subscriptions. Entitlement code receives only normalized statuses.
- [x] Route changes apply only to new checkout attempts. Existing subscriptions keep their original provider until an explicit migration/cancellation flow.
- [x] Provider errors map to stable domain error codes and safe user copy; raw provider bodies and credentials never reach the browser.

### Database

- [x] Extend billing provider constraints with `asaas`.
- [x] Add `subscription_plan_localizations` for locale, name, short/long descriptions, checkout badge, CTA, and feature highlights.
- [x] Add `billing_payment_method_routes` for method, provider, priority, enabled state, and currency.
- [x] Add `billing_checkout_attempts` separate from `user_subscriptions` so opening or retrying checkout cannot grant access or collide with a confirmed subscription.
- [x] Seed Stripe routes for `card`, `apple_pay`, and `google_pay`, and Asaas for `pix`.
- [x] Seed localized Free and Pro product content and Asaas monthly/annual prices.

### Stripe Adapter

- [x] Create a Checkout Session in `subscription` + `ui_mode: elements` (the current SDK name for the custom Elements flow), returning only its client secret to Stripe Checkout Elements.
- [x] Render Payment Element for card and Express Checkout Element for available Apple Pay/Google Pay wallets.
- [ ] Register the production domain for wallet use in both Stripe test and live modes.
- [x] Use `invoice.paid` as the authoritative payment event before activating/renewing Stripe access; checkout completion alone is not fulfillment.
- [x] Read period boundaries from subscription items for the current Stripe API contract.
- [x] Map `unpaid` to expired access.
- [ ] Add persisted Stripe event ordering so a delayed older event cannot regress a newer normalized subscription state.

### Asaas Adapter

- [x] Authenticate server calls with `access_token`; use sandbox/production base URL from configuration.
- [x] Reuse an existing Asaas customer ID or create a customer with a stable opaque external reference.
- [x] Create a `PIX` subscription with `MONTHLY`/`YEARLY`, then retrieve its first payment and dynamic QR code.
- [x] Return the QR image, copy-and-paste payload, and expiration without exposing API credentials.
- [x] Treat Pix subscription as scheduled recurring QR charges, not automatic debit. Future charges are reconciled from payment webhooks.
- [x] Verify `asaas-access-token` in constant time and claim the Asaas event ID idempotently.
- [x] Grant/renew only on `PAYMENT_RECEIVED`; do not grant on `PAYMENT_CREATED` or `PAYMENT_CONFIRMED`.
- [x] Normalize overdue, refund, deletion, and chargeback outcomes; tolerate unknown attributes/events.

### API and UI Flow

- [x] `GET /api/billing/catalog?locale=pt-BR` returns localized plans, prices, discount, and available payment methods.
- [x] `POST /api/billing/checkout` validates plan, interval, locale, method, and Pix payer data; persists an attempt; delegates through the provider registry.
- [x] `GET /api/billing/checkout/[id]` returns only the authenticated user's normalized attempt status for the Pix confirmation screen.
- [x] `POST /api/webhooks/asaas` authenticates, deduplicates, normalizes, and updates subscription/entitlement state.
- [x] The checkout success UI never claims payment based only on browser navigation; it waits for normalized server confirmation.

### Configuration and Rollout

- [x] Add placeholders for `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `ASAAS_API_KEY`, `ASAAS_API_URL`, and `ASAAS_WEBHOOK_TOKEN`.
- [x] Keep GitHub environment secrets/variables as production source of truth and pass the Stripe publishable key as a Docker build argument.
- [ ] Configure real Asaas sandbox credentials, Pix key, and webhook URL/token outside git.
- [ ] Configure Stripe wallet payment methods and register `app.flow-me.online` in test and live modes.
- [ ] Apply the migration, run Stripe/Asaas sandbox contract tests, and execute the desktop/mobile manual checkout matrix before production enablement.

### Required Tests

- [x] Catalog locale normalization, annual discount, provider route resolution, and invalid checkout input.
- [x] Stripe custom-session contract and authoritative invoice payment mapping.
- [x] Asaas customer reuse, Pix subscription/QR contract, safe provider error mapping, token verification, payment received, overdue, and refund normalization.
- [x] Cover duplicate webhook delivery without repeating entitlement effects.
- [ ] Add Asaas sandbox fixture coverage for a second-cycle renewal.
- [x] Checkout attempts never grant entitlements before a paid event.
- [ ] Browser E2E with real Stripe test Elements/wallet availability and Asaas sandbox Pix confirmation.

## Stripe Web Billing

### Stripe Setup

- [x] Use Stripe Checkout in subscription mode for the simplest PCI path.
- [x] Use Stripe-hosted Checkout to keep card data out of Flow Me.
- [x] Use Stripe Billing for recurring payments.
- [x] Use Stripe-hosted surfaces only for PCI-sensitive actions:
  - Update payment method through a focused Stripe payment method update flow.
  - Keep broad subscription management out of the primary UX.
- [x] View invoices/receipts inside Flow Me using Stripe invoice APIs.
- [x] Route web subscription cancellation requests to Balys Support retention funnel instead of direct broad Stripe Portal cancellation.
- [x] Configure products/prices in Stripe:
  - Product: Flow Me Pro.
  - Price: Pro Monthly BRL R$59,90.
  - Price: Pro Annual BRL R$478,80.
- [x] Store Stripe IDs in env/config, not hardcoded.

### Stripe API Routes

- [x] `POST /api/billing/checkout`
  - Requires auth.
  - Accepts `price_id` or `interval`.
  - Creates/reuses Stripe Customer.
  - Creates Checkout Session with `mode: subscription`.
  - Adds metadata: `user_id`, `plan_code`.
  - Returns checkout URL.
- [x] `POST /api/billing/portal`
  - Requires auth.
  - Creates focused payment method update session for the user's Stripe Customer.
- [x] `GET /api/billing/invoices`
  - Requires auth.
  - Lists recent Stripe invoices/receipts for the user's Stripe Customer.
- [x] `POST /api/webhooks/stripe`
  - Raw body signature verification.
  - Idempotency with `billing_events`.
  - Re-fetch Stripe subscription when needed.
  - Updates `user_subscriptions`.
  - Recomputes `user_entitlements`.
- [x] Stripe webhook events to handle:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `invoice.payment_action_required`
  - `invoice.finalization_failed`
- [x] Stripe webhook response is fast and idempotent.
  - Status: complete. The webhook persists subscription state, entitlements, and the pending notification without waiting for external channels.
  - Implemented design:
    - Keep signature verification, event deduplication, subscription/entitlement persistence, and durable notification creation inside the webhook transaction path.
    - Persist the notification as `pending`, mark the Stripe event processed after durable local state exists, and return `2xx` without waiting for external notification providers.
    - A worker/cron dispatcher claims pending notifications safely, records each channel result, and retries transient failures with bounded backoff.
    - Disable invalid device tokens, preserve the in-app alert even when every external channel fails, and surface exhausted retries to the admin dashboard.
    - Test that APNs, FCM, Web Push, or WhatsApp outages do not make Stripe retry an otherwise valid billing event.

### Stripe Payment Failure Flow

- [x] On `invoice.payment_failed`:
  - Mark subscription `past_due` or equivalent.
  - Store `last_payment_failure_at`.
  - Keep entitlement active during configured grace period if desired.
  - Create in-app billing alert.
  - Send push notification if device token exists.
  - Send WhatsApp if channel connected.
  - CTA points to Billing Portal to update payment method.
- [x] On `invoice.payment_action_required`:
  - Notify user to authenticate/confirm payment.
  - CTA to Stripe-hosted payment flow.
- [x] On `invoice.paid`:
  - Mark active.
  - Clear billing alert.
  - Send recovery confirmation only if useful.
- [x] On terminal cancellation/expiration:
  - Downgrade entitlement to Free at `current_period_end` or immediately depending on provider state.

## Mobile IAP Billing Model

### Shared Backend Contract

- [ ] Mobile app starts in Free.
- [ ] User must sign in with Google to continue.
- [ ] Mobile sends Apple/Google purchase receipt/token to backend.
- [x] Backend validates with Apple/Google server APIs.
- [x] Backend writes `user_subscriptions`.
- [x] Backend recomputes `user_entitlements`.
- [x] App and web both read the same entitlements.

### Apple

- [ ] Use StoreKit 2 in mobile app.
- [x] Use App Store Server Notifications V2 on backend.
- [x] Track billing retry and grace period.
- Operational note: Apple may retry billing for up to 60 days.
- [x] If grace period is enabled, keep Pro access until grace expires.
- [ ] Notify in-app when Apple indicates billing issue.
- [x] Web CTA deep links to Apple billing management.

### Google Play

- [ ] Use Google Play Billing Library in mobile app.
- [x] Use Real-time Developer Notifications (RTDN) with Pub/Sub.
- [x] On RTDN, backend calls Google Play Developer API to fetch current subscription state.
- [x] Handle:
  - `SUBSCRIPTION_PURCHASED`
  - `SUBSCRIPTION_RENEWED`
  - `SUBSCRIPTION_CANCELED`
  - `SUBSCRIPTION_EXPIRED`
  - `SUBSCRIPTION_IN_GRACE_PERIOD`
  - `SUBSCRIPTION_ON_HOLD`
  - `SUBSCRIPTION_RECOVERED`
- [x] During grace period, entitlement may remain active.
- [x] During account hold, entitlement is degraded to Free.
- Operational note: Google may show its own in-app messaging for payment issues; backend still keeps source of truth.

## Feature Gating UX

### Global UX

- [x] Add `SubscriptionProvider` in the app shell.
- [x] Load `/api/billing/entitlements` on app start.
- [x] Cache short-lived entitlement state client-side.
- [x] Revalidate on route changes and after checkout.
- [x] Add `FeatureGate` component.
- [x] Add `UpgradeDialog`.
- [x] Add AI credit meter in the Balys header.

### Platform Billing UX

- [ ] Use one product/plan presentation across web, iOS, and Android:
  - Free.
  - Pro Monthly.
  - Pro Annual.
- [ ] Route payment actions by runtime platform:
  - Web browser: Stripe Checkout and Stripe Customer Portal.
  - iOS native app: App Store In-App Purchase and Apple subscription management.
  - Android native app: Google Play Billing and Google Play subscription management.
- [x] The web app shows Stripe checkout CTAs.
- [ ] The iOS app must not send users to Stripe or an external website to buy the digital subscription.
- [ ] The Android app must not force users outside Google Play Billing for in-app digital subscription purchase.
- [ ] If a user subscribed on web and opens mobile:
  - Show Pro active.
  - Do not ask the user to subscribe again through IAP.
  - Management CTA explains the subscription is managed on web/Stripe.
- [x] If a user subscribed through Apple/Google and opens web:
  - Show Pro active.
  - Hide Stripe checkout for the active subscription.
  - Management CTA explains the subscription is managed through App Store or Google Play.
- [ ] Pricing display:
  - Web prices come from Flow Me/Stripe config.
  - Mobile prices should come from App Store / Google Play product metadata because stores may apply local pricing, taxes, and currency rules.
- [x] Backend entitlement response should expose:
  - `billing_provider`.
  - `billing_state`.
  - `current_period_end`.
  - `management_surface`: `stripe`, `apple`, `google`, or `none`.
- [x] UI copy should be provider-aware:
  - Stripe: "Gerenciar assinatura".
  - Apple: "Gerenciar na App Store".
  - Google: "Gerenciar no Google Play".

### Free Navigation

- [x] Free users see all nav items, but locked items have lock/badge.
- [x] Clicking locked nav item opens upgrade dialog instead of route.
- [x] Notes and BalysAI remain accessible.
- [x] Pricing CTA:
  - "Desbloquear Pro"
  - "Tudo do Flow Me + IA ilimitada"
  - Monthly and annual options.

### Route Protection

- [x] Server/API route guards for paid features.
- [x] Client route gates for UX.
- [x] Never rely only on client gating.
- [x] Protected API calls return:
  - `402 PAYMENT_REQUIRED`
  - `FEATURE_LOCKED`
  - `required_plan: pro`
  - `upgrade_url` or `checkout_available: true`
- [x] Balys tools check entitlements before executing paid actions.

### AI Credit Exhaustion

- [x] When Free user has 0 credits:
  - Balys input remains visible.
  - Send is disabled or opens upgrade dialog.
  - Message: "Seus créditos de IA de hoje acabaram. Eles renovam amanhã, ou você pode liberar IA ilimitada com Pro."
  - CTA: "Fazer upgrade para Pro."
- [x] If a prompt would exceed remaining credits:
  - Show preflight warning for expensive actions.
  - Example: "Essa ação usa 4 créditos; você tem 2."
- [x] If usage fails mid-request:
  - Return graceful Balys message, not technical error.

## Free vs Pro Enforcement Matrix

| Area | Free | Pro | Enforcement |
|---|---|---|---|
| Notes | allowed | allowed | route/API |
| Balys text | limited daily credits | unlimited | chat preflight + usage logging |
| Calendar | locked | allowed | route/API/tool |
| Today | locked | allowed | route/API |
| Goals | locked | allowed | route/API/tool |
| Finance | locked | allowed | route/API/tool |
| Reviews | locked | allowed | route/API/tool/cron |
| Connectors | locked | allowed | route/API/tool |
| WhatsApp | locked | allowed | API/webhook response/gating |
| Briefings | locked | allowed | preferences/cron |
| Reminders | locked | allowed | API/tool/cron |
| Meetings | locked | allowed | upload/API/cron |
| Images | locked | allowed | tool |
| Support | allowed | allowed | support scope differs if needed |

## Billing Notifications

### Channels

- [x] In-app notification banner.
- [x] Web push notification through existing browser Web Push/VAPID channel.
- [x] Mobile push notification:
  - iOS: APNs.
  - Android: FCM.
  - Backend Flow Me stores device tokens and dispatches notifications.
  - FCM/APNs are transport only; no Firebase backend, Firestore, Auth, or Cloud Functions dependency.
- [x] WhatsApp message if connected.
- Optional later: billing email notifications.

### Mobile Push Token Registry

- [x] Add `mobile_push_tokens` table:
  - `id`
  - `user_id`
  - `platform`: `ios`, `android`
  - `provider`: `apns`, `fcm`
  - `device_token`
  - `device_id`
  - `app_version`
  - `os_version`
  - `locale`
  - `timezone`
  - `enabled`
  - `last_seen_at`
  - `created_at`
  - `updated_at`
- [x] Add API routes:
  - `POST /api/mobile/push-tokens`
  - `DELETE /api/mobile/push-tokens`
- [ ] Mobile app registers token after Google sign-in.
- [ ] Mobile app refreshes token when APNs/FCM rotates it.
- [x] Backend marks invalid tokens disabled after provider delivery failure.
- [x] Notification delivery code must choose:
  - browser Web Push for `web_push_subscriptions`
  - APNs for iOS `mobile_push_tokens`
  - FCM for Android `mobile_push_tokens`

### Stripe Site Subscription

- [x] `invoice.payment_failed`:
  - In-app: persistent billing banner.
  - Push: "Não conseguimos renovar sua assinatura Flow Me Pro."
  - WhatsApp: concise payment update message with secure link to billing portal.
- [x] `invoice.payment_action_required`:
  - In-app/push/WhatsApp with authentication CTA.
- [x] Recovery:
  - Clear banner after `invoice.paid`.

### Apple/Google In-App Purchase

- [ ] Apple:
  - Use App Store Server Notifications for backend state.
  - In-app text explains Apple handles payment update.
- [ ] Google:
  - Use RTDN + Play Developer API for backend state.
  - In-app text explains Google Play handles payment update.
- [x] For mobile billing failures, CTA opens store subscription management, not Stripe.

## Support Section

### Product Surface

- [x] Add route `app/app/support/page.tsx`.
- [x] Add sidebar item "Suporte".
- [x] Support page layout:
  - Balys support chat as primary panel.
  - Quick questions grid.
  - Account/billing state card.
  - Recent support requests/cancellation requests if any.
- [x] Support Balys should not execute destructive account changes directly.
- [x] Support Balys can create support/cancellation requests in DB.

### Support Knowledge Base

- [x] Create `lib/support/knowledge-base.ts`.
- [x] Create structured KB sections:
  - What Flow Me is.
  - Free vs Pro.
  - AI credits.
  - Billing and payment.
  - Stripe web subscription.
  - Apple IAP.
  - Google Play Billing.
  - Notes.
  - BalysAI.
  - Calendar and Today.
  - Goals and action plans.
  - Finance management.
  - Weekly Review and Monthly Review.
  - Council mentorship.
  - Connectors.
  - WhatsApp mentorship and reminders.
  - Daily briefings.
  - Meeting recording/transcription.
  - Image generation.
  - Privacy and data.
  - Troubleshooting.
- [x] Support Balys prompt must:
  - Use KB first.
  - Answer in user's language.
  - Avoid hallucinating policies.
  - Give step-by-step support.
  - Offer human escalation when billing/account risk exists.

### Quick Questions

- [x] Add quick question buttons:
  - "Como eu começo no Flow Me?"
  - "Como usar o BalysAI melhor?"
  - "Como funcionam os créditos de IA?"
  - "Qual a diferença entre Free e Pro?"
  - "Como conectar meu WhatsApp?"
  - "Como usar o Balys pelo WhatsApp?"
  - "Como criar lembretes?"
  - "Como entrar em flow hoje?"
  - "Como o Today organiza meu dia?"
  - "Como criar uma meta e um plano?"
  - "Como funciona o conselho?"
  - "Como funciona a revisão semanal?"
  - "Como funciona a revisão mensal?"
  - "Como registrar despesas?"
  - "Como ver minha saúde financeira?"
  - "Como conectar Google Docs/Sheets/Drive/Gmail?"
  - "Como gravar e revisar reuniões?"
  - "Estou com problema de pagamento"
  - "Quero cancelar minha assinatura"
- [x] Clicking a quick question injects and sends the prompt immediately.
- Optional later: localize support quick questions.

### Support API

- [x] `POST /api/support/chat`
  - Support-only Balys route.
  - Injects support KB.
  - Lower-risk toolset.
  - Can open support tickets/cancellation requests.
- Optional later: `GET /api/support/knowledge`
  - Optional admin/dev preview.
- [x] `GET /api/support/requests`
  - User sees their own requests.

## Cancellation Funnel

### Trigger Detection

- [x] Support Balys detects cancellation intent:
  - "cancelar"
  - "quero cancelar"
  - "cancela minha assinatura"
  - "não quero mais pagar"
  - "unsubscribe"
  - "cancel subscription"
- [x] Do not immediately cancel.
- [x] Start guided cancellation form.

### Required Questions

- [x] Question 1:
  - "Qual o principal motivo do cancelamento?"
  - Minimum 100 characters.
- [x] Question 2:
  - "Quais funcionalidades mais te decepcionaram?"
  - Minimum 10 characters.
- [x] Question 3:
  - "Qual expectativa não foi atendida?"
  - Minimum 10 characters recommended.
- [x] Question 4:
  - "Se um suporte humano te instruir melhor, você daria uma segunda chance?"
  - Required yes/no.
- [x] Submit creates an open request.
- [x] Do not auto-cancel until request is reviewed, unless product/legal decision later requires immediate self-service cancellation.

### Cancellation Database

- [x] Create `subscription_cancellation_requests`:
  - `id`
  - `user_id`
  - `subscription_id`
  - `billing_provider`
  - `status`: `open`, `in_review`, `retained`, `approved_cancel`, `canceled`, `closed`
  - `reason`
  - `disappointing_features`
  - `unmet_expectation`
  - `would_accept_human_support`
  - `source`: `support_balys`, `billing_page`, `mobile`
  - `assigned_to`
  - `admin_notes`
  - `created_at`
  - `updated_at`
  - `resolved_at`
- [x] Add admin/dev query surface later.
- [x] Add notification to owner/dev on new cancellation request.

### UX States

- [x] If user abandons funnel:
  - Keep draft in local/session state.
- [x] If request is open:
  - Show "Sua solicitação está em análise."
  - Offer support follow-up.
- [x] If payment provider is Apple/Google:
  - Explain cancellation must be completed in App Store/Google Play if user wants immediate store-level cancellation.
  - Still collect feedback and create internal request.
- [x] If provider is Stripe:
  - Internal request is enough for dev/support review.
  - Decide later whether to expose direct Stripe Portal cancellation.

## Admin/Internal Operations

- [x] Add internal admin page later:
  - `/app/admin/billing` or Supabase-only initially.
- [x] Admin capabilities:
  - View user entitlement.
  - View subscription provider/status.
  - View failed payments.
  - View cancellation requests.
  - Mark cancellation request status.
  - Add admin notes.
- Optional later: add a daily admin digest:
  - New cancellation requests.
  - Failed payment notifications.
  - High AI cost users.

## Implementation Phases

### Phase 1 - Entitlements Foundation

- [x] Migration for plans, prices, subscriptions, entitlements, billing events.
- [x] Entitlement library.
- [x] `/api/billing/entitlements`.
- [x] Default Free entitlements.
- [x] Tests for entitlement mapping.
- [x] Route/API feature gates for obvious paid surfaces.
  - Status: complete.
  - [x] Standard `402 FEATURE_LOCKED` response with `required_plan`, `feature_key`, and `checkout_available`.
  - [x] Finance profile, summary, and transaction APIs.
  - [x] Connector list/create APIs.
  - [x] Connector item/connect/disconnect APIs and Balys connector tools, including Slack.
  - [x] Goals APIs and Balys tools.
  - [x] Calendar and Today pages, APIs, external Calendar API, and Balys tools.
  - [x] Reviews, briefings, and reminders pages/APIs/tools/background jobs.
  - [x] Meetings pages/APIs/tools and background processing.
  - [x] Image generation tool and generated-image API.
  - [x] WhatsApp channel APIs and inbound Balys execution.

### Phase 2 - AI Credits

- [x] `ai_credit_events` migration.
- [x] Credit policy library.
- [x] Credit meter API.
- [x] Balys preflight for Free.
- [x] AI usage instrumentation.
- [x] Exhaustion UX.
- [x] Tests for daily reset and credit consumption.

### Phase 3 - Stripe Web Billing

- [x] Install/configure Stripe SDK.
- [x] Env vars:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRO_MONTHLY_PRICE_ID`
  - `STRIPE_PRO_ANNUAL_PRICE_ID`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if needed.
- [x] Checkout route.
- [x] Portal route.
- [x] Stripe webhook route.
- [ ] Local Stripe CLI webhook test.
- [x] Checkout success/cancel pages or query states.
- [x] Tests for webhook idempotency and entitlement changes.

### Phase 4 - Pricing and Upgrade UX

- [x] Pricing page or modal.
- [x] Platform-aware billing UI:
  - Web uses Stripe Checkout/Portal.
  - iOS uses App Store IAP purchase/management.
  - Android uses Google Play Billing purchase/management.
- [x] Upgrade CTA from locked routes.
- [x] Upgrade CTA from credit exhaustion.
- [x] Billing page in settings.
- [x] Annual/monthly toggle.
- [x] Stripe redirect.
- [x] Post-checkout entitlement refresh.
- [x] Tests for locked API responses.

### Phase 5 - Billing Failure Notifications

- [x] In-app billing alert model.
- [x] Push notification on Stripe failure:
  - browser Web Push when available.
  - APNs for iOS mobile app.
  - FCM for Android mobile app.
- [x] WhatsApp failure notification if connected.
- [x] Billing Portal CTA.
- [x] Recovery clearing on `invoice.paid`.
- [x] Tests for notification event creation.
- Status: complete.

### Phase 5.1 - Mobile Push Delivery Foundation

- [x] Migration for `mobile_push_tokens`.
- [x] Mobile push token registration API.
- [x] Provider-neutral push dispatch interface.
- [x] APNs adapter and config contract.
- [x] FCM adapter and config contract.
- [x] Tests for token registration, validation, ownership, and soft-delete.
- [x] Tests for provider routing, delivery, and invalid-token disabling.
- Status: complete.

### Phase 6 - Support Section

- [x] Support route/page.
- [x] Support KB.
- [x] Quick questions.
- [x] Support chat route.
- [x] Support request model.
- [x] Billing-aware support answers.
- [x] Tests for KB prompt and support route validation.
- Status: complete.

### Phase 7 - Cancellation Funnel

- [x] Cancellation intent detector.
- [x] Guided form state.
- [x] Validation:
  - Reason min 100 chars.
  - Features min 10 chars.
  - Expectation required.
  - Second chance yes/no required.
- [x] Cancellation request API.
- [x] Open request status UI.
- [x] Dev/admin notification.
- [x] Tests for cancellation validation.
- Status: complete.

### Phase 8 - Mobile Billing Integration Contract

- [x] Add provider-neutral receipt/subscription endpoints:
  - `POST /api/billing/apple/verify`
  - `POST /api/billing/google/verify`
  - `POST /api/webhooks/apple`
  - `POST /api/webhooks/google-play`
- [x] Do not implement mobile app here, but prepare web backend contract.
- [x] Document expected mobile payloads.
- [x] Tests with mocked provider responses.
- Status: complete.

### Phase 9 - Observability and Reconciliation

- [x] Billing reconciliation job:
  - Stripe subscription state vs local state.
  - Apple/Google state vs local state when applicable.
- [x] AI cost dashboard.
- [x] Alerts:
  - Webhook failures.
  - High AI cost.
  - Subscription state mismatch.
  - New cancellation request.
- [x] Add runbook docs.
- Status: complete.

## Security and Compliance

- [x] Use Stripe-hosted Checkout and Portal to minimize PCI scope.
- [x] Verify Stripe webhook signature with raw body.
- [x] Never store card data.
- [x] Store provider customer/subscription IDs only.
- [x] RLS:
  - Users can read their own subscription/entitlement/support request.
  - Users cannot write entitlement directly.
  - Service role/webhooks update billing state.
- [x] Webhook idempotency for all providers.
- [x] Avoid exposing technical provider IDs in user-facing UI.
- [x] Support Balys must not reveal internal logs, secrets, or provider payloads.

## Open Product Decisions

- [x] Exact Free daily credits: 10/day at launch.
- [x] Free image generation: disabled at launch.
- [x] Stripe cancellation: route through the support funnel; do not expose broad Portal cancellation in the primary UX.
- [x] Pro "unlimited": no ordinary visible fair-use cap; keep provider protection internal.
- [x] Annual plan trial: no trial initially; Free is the entry experience.
- [x] Annual price display: show R$39,90/month and R$478,80 billed annually.

## Remaining Work to Close Billing

### Web Launch Blockers

- [x] Decouple external notification delivery from the Stripe webhook request.
  - The webhook must durably persist billing state, entitlements, and a pending notification, then return `2xx`.
  - Web Push, APNs, FCM, and WhatsApp delivery must run in a retryable worker/cron path.
  - Provider outages must not cause Stripe to retry an event whose local billing state was already saved.
- [x] Add Pro fair-use and provider-protection guardrails.
  - Per-user short-window throttling for AI requests.
  - Concurrency limits for expensive asynchronous jobs.
  - Configurable daily protection caps for images, meetings, grounded search, Council/reviews, and similar high-cost workloads.
  - Friendly retry-later UX and admin alerts for repeated or extreme use, without showing an ordinary Pro credit quota.
- [x] Add Free expensive-action preflight UX.
  - The atomic database function already prevents overspending under concurrency.
  - Before starting a known expensive action, compare its estimated credit cost with the current remaining balance.
  - If the action cannot fit, explain the cost and remaining balance before invoking an AI provider.
- [ ] Run the real Stripe test-mode validation.
  - Products and monthly/annual prices are already configured.
  - Validate Checkout, initial entitlement, renewal, payment failure, payment recovery, cancellation, and webhook idempotency with Stripe CLI/test mode.
- [ ] Run the complete manual Free/Pro validation matrix below on desktop and mobile web.
- [ ] Publish the current migrations and application changes through GitHub CI/CD after GitHub CLI authentication is restored.

### Architecture Follow-up Before Adding More Plans

- [ ] Make plan policies data-driven rather than hardcoded to `free` and `pro`.
  - Remove the database plan-code enum check and rely on the plan foreign key.
  - Resolve feature availability, AI credit allowance, and unlimited status from plan policy data.
  - Map provider prices by `plan_code + provider + interval` instead of Pro-specific environment names.
  - Replace new business decisions based on `has_pro` with capability checks while retaining `has_pro` temporarily for compatibility.
  - This is not required to launch Free + Pro, but should precede Starter, Team, Business, add-ons, or custom credit allowances.

### Mobile Billing Launch Work

- [ ] Implement mandatory Google sign-in and Free entry in the native app.
- [ ] Implement StoreKit 2 purchases and subscription management on iOS.
- [ ] Implement Google Play Billing purchases and subscription management on Android.
- [ ] Register and rotate APNs/FCM device tokens from the native app.
- [ ] Load localized prices from App Store/Google Play product metadata.
- [ ] Validate cross-platform ownership and management messaging in the native UI.
- [ ] Create and clear provider-aware billing notifications for Apple/Google billing failures and recoveries; subscription-state synchronization already exists.

### Optional Backlog

- [ ] Prefer actual provider usage metadata wherever the provider exposes it.
- [ ] Add localized support quick questions.
- [ ] Add optional admin/dev support knowledge preview endpoint.
- [ ] Add an optional daily admin digest; real-time alerts and daily reconciliation already exist.
- [ ] Add optional billing email notifications later.

## Validation Checklist

- [ ] Free user cannot access locked routes through URL.
- [ ] Free user cannot execute paid API/tool calls.
- [ ] Free user sees clear upgrade CTA on locked features.
- [ ] Free user sees credit meter and daily reset.
- [ ] Free user gets helpful feedback when credits end.
- [ ] Pro user can access all current product surfaces.
- [ ] Stripe checkout creates subscription and entitlements.
- [ ] Stripe renewal keeps entitlements active.
- [ ] Stripe failed payment creates notification and billing state.
- [ ] Stripe recovery clears failure state.
- [x] Support KB answers core product questions.
- [x] Cancellation funnel enforces required minimums.
- [x] Cancellation request persists for dev/admin review.
- [x] Mobile provider subscription schema is ready for future app.

## Reference Notes

- Stripe Checkout supports hosted subscription checkout and helps minimize PCI scope through hosted payment collection.
- Stripe subscription webhooks such as `invoice.paid`, `invoice.payment_failed`, and subscription updates should drive local entitlement state.
- Apple subscriptions can enter billing retry; Apple attempts renewal for up to 60 days, and apps can optionally offer grace period.
- Google Play subscriptions use RTDN; backend must call Google Play Developer API after notifications to get the complete current subscription state. Google subscriptions may enter grace period and then account hold if unresolved.
