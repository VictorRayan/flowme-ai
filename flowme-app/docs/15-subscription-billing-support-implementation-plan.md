# Subscription, Credits, Billing, and Support Implementation Plan

## Decision Summary

- [ ] Web app plans:
  - Free: access only to Notes and BalysAI.
  - Pro: access to everything.
- [ ] Free AI usage is limited by daily AI credits, not raw tokens.
- [ ] Pro has unlimited AI credits from the user's point of view, with internal fair-use and abuse protection.
- [ ] Pro web pricing:
  - Monthly: R$59,90/month.
  - Annual: R$39,90/month billed annually, equivalent to R$478,80/year.
- [ ] Web payments use Stripe Checkout + Stripe Billing + Stripe Customer Portal.
- [ ] Mobile app will use Free entry + mandatory Google sign-in + native IAP:
  - iOS: App Store In-App Purchase.
  - Android: Google Play Billing.
- [ ] Backend entitlements are shared across web, iOS, and Android so the user has one subscription state.
- [ ] Payment failures from Stripe trigger in-app, push, and WhatsApp notifications when channels are available.
- [ ] Apple/Google IAP billing-state changes are handled through store server notifications and backend reconciliation.
- [ ] Add a Support section guided by Balys with product knowledge, quick questions, and a cancellation request funnel.

## Product Principles

- [ ] The user should understand usage in plain language.
- [ ] Never expose token counts as the main concept.
- [ ] Use "AI credits" as a simple daily allowance for Free.
- [ ] Show upgrade CTAs at the moment of intent, not only in a pricing page.
- [ ] Avoid dead ends: every locked feature should explain why it is locked and what Pro unlocks.
- [ ] Keep Free valuable enough to prove the product:
  - Notes.
  - Limited BalysAI.
  - Clear upgrade path.
- [ ] Keep Pro simple:
  - All product surfaces.
  - Unlimited AI credits.
  - Premium channels and automations.

## Plan Definitions

### Free

- [ ] Accessible features:
  - Notes.
  - BalysAI with daily AI credits.
  - Account/profile/settings.
  - Billing/pricing/support.
- [ ] Locked features:
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
- [ ] Free daily AI credits reset every day in the user's timezone.
- [ ] Free AI credit display should be understandable:
  - Example: "Você tem 7 de 10 créditos de IA hoje."
  - Avoid: "Você usou 12.830 tokens."
- [ ] Recommended initial Free allowance:
  - 10 AI credits/day.
  - Simple Balys text answer: 1 credit.
  - Tool action: 2-4 credits depending on cost.
  - Web search/grounded answer: locked or 4 credits.
  - Council/reviews/images/meetings: Pro only.

### Pro

- [ ] Accessible features:
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
- [ ] Pricing:
  - Monthly: R$59,90.
  - Annual: R$478,80/year.
- [ ] Pro UI copy:
  - "Créditos de IA ilimitados no Pro."
  - Internally still enforce abuse protection, provider outage protection, and extreme usage review.
- [ ] Internal fair-use guardrails:
  - Per-minute request throttling.
  - Daily high-cost job caps for provider protection.
  - Admin alert if one user exceeds expected cost thresholds.
  - Never show "fair use" as ordinary UX unless the account is clearly abusive or provider-limited.

## AI Credit Model

### User-Facing Model

- [ ] Use "credits" as the user concept.
- [ ] Show Free daily allowance in a small Balys header indicator:
  - "8 créditos hoje."
  - Warning state at 20% remaining.
  - Empty state at 0 credits.
- [ ] Show a friendly explanation:
  - "Créditos medem o uso de IA. Perguntas simples usam pouco; ações com busca, arquivos ou análise usam mais."
- [ ] Do not show token counts by default.
- [ ] Add "Ver detalhes" only if needed, with human-readable categories.

### Internal Cost Mapping

- [ ] Add `ai_credit_events` table:
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
- [ ] Add `ai_credit_daily_usage` materialized view or query helper:
  - sum credits by `user_id`, local date, source.
- [ ] Add `plan_credit_policies` in code:
  - Free: 10/day.
  - Pro: unlimited display, internal abuse thresholds.
- [ ] Instrument the major AI paths:
  - Balys chat.
  - Context scorer.
  - Tool calls that invoke AI.
  - Image generation.
  - Briefing grounded search.
  - Weekly/monthly review Council.
  - Meeting transcription/summary.
  - Thread summarizer/profile updater.
- [ ] Start with estimates where providers do not return usage metadata.
- [ ] Prefer actual provider usage metadata when available.

### Suggested Credit Costs

- [ ] Balys simple answer: 1 credit.
- [ ] Balys with one deterministic tool: 2 credits.
- [ ] Connector read/analyze: 3 credits.
- [ ] Web grounded search: 4 credits.
- [ ] Image generation: Pro only, or 8 credits if sampled later.
- [ ] Weekly/Monthly Review: Pro only.
- [ ] Meeting transcription: Pro only.
- [ ] Daily briefing: Pro only.

## Entitlements Architecture

### Database

- [ ] Add migration `049_subscriptions_entitlements_support.sql`.
- [ ] Create `subscription_plans`:
  - `id`
  - `code`: `free`, `pro`
  - `name`
  - `status`
  - `metadata`
- [ ] Create `subscription_prices`:
  - `id`
  - `plan_code`
  - `billing_provider`: `stripe`, `apple`, `google`
  - `billing_interval`: `monthly`, `annual`
  - `currency`
  - `amount_cents`
  - `provider_price_id`
  - `provider_product_id`
  - `active`
- [ ] Create `user_subscriptions`:
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
- [ ] Create `user_entitlements`:
  - `user_id`
  - `plan_code`
  - `has_pro`
  - `billing_state`
  - `access_until`
  - `features`
  - `updated_at`
- [ ] Create `billing_events`:
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
- [ ] Create `billing_notifications`:
  - `id`
  - `user_id`
  - `kind`
  - `provider`
  - `status`
  - `channels_attempted`
  - `created_at`
  - `sent_at`

### Entitlement Library

- [ ] Add `lib/billing/entitlements.ts`.
- [ ] Provide:
  - `getUserEntitlements(supabase, userId)`.
  - `isFeatureAllowed(entitlements, featureKey)`.
  - `requireFeature(featureKey)`.
  - `getAiCreditState(userId, timezone)`.
  - `consumeAiCredits(input)`.
  - `syncEntitlementFromSubscription(subscription)`.
- [ ] Feature keys:
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
- [ ] Default user without subscription row gets Free entitlements.

## Stripe Web Billing

### Stripe Setup

- [ ] Use Stripe Checkout in subscription mode for the simplest PCI path.
- [ ] Use Stripe-hosted Checkout to keep card data out of Flow Me.
- [ ] Use Stripe Billing for recurring payments.
- [ ] Use Stripe Customer Portal for:
  - Update payment method.
  - View invoices.
  - Manage/cancel web subscription if we allow direct portal cancellation.
- [ ] Configure products/prices in Stripe:
  - Product: Flow Me Pro.
  - Price: Pro Monthly BRL R$59,90.
  - Price: Pro Annual BRL R$478,80.
- [ ] Store Stripe IDs in env/config, not hardcoded.

### Stripe API Routes

- [ ] `POST /api/billing/checkout`
  - Requires auth.
  - Accepts `price_id` or `interval`.
  - Creates/reuses Stripe Customer.
  - Creates Checkout Session with `mode: subscription`.
  - Adds metadata: `user_id`, `plan_code`.
  - Returns checkout URL.
- [ ] `POST /api/billing/portal`
  - Requires auth.
  - Creates Billing Portal session for the user's Stripe Customer.
- [ ] `POST /api/webhooks/stripe`
  - Raw body signature verification.
  - Idempotency with `billing_events`.
  - Re-fetch Stripe subscription when needed.
  - Updates `user_subscriptions`.
  - Recomputes `user_entitlements`.
- [ ] Stripe webhook events to handle:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `invoice.payment_action_required`
  - `invoice.finalization_failed`
- [ ] Stripe webhook response must be fast and idempotent.

### Stripe Payment Failure Flow

- [ ] On `invoice.payment_failed`:
  - Mark subscription `past_due` or equivalent.
  - Store `last_payment_failure_at`.
  - Keep entitlement active during configured grace period if desired.
  - Create in-app billing alert.
  - Send push notification if device token exists.
  - Send WhatsApp if channel connected.
  - CTA points to Billing Portal to update payment method.
- [ ] On `invoice.payment_action_required`:
  - Notify user to authenticate/confirm payment.
  - CTA to Stripe-hosted payment flow.
- [ ] On `invoice.paid`:
  - Mark active.
  - Clear billing alert.
  - Send recovery confirmation only if useful.
- [ ] On terminal cancellation/expiration:
  - Downgrade entitlement to Free at `current_period_end` or immediately depending on provider state.

## Mobile IAP Billing Model

### Shared Backend Contract

- [ ] Mobile app starts in Free.
- [ ] User must sign in with Google to continue.
- [ ] Mobile sends Apple/Google purchase receipt/token to backend.
- [ ] Backend validates with Apple/Google server APIs.
- [ ] Backend writes `user_subscriptions`.
- [ ] Backend recomputes `user_entitlements`.
- [ ] App and web both read the same entitlements.

### Apple

- [ ] Use StoreKit 2 in mobile app.
- [ ] Use App Store Server Notifications V2 on backend.
- [ ] Track billing retry and grace period.
- [ ] Apple may retry billing for up to 60 days.
- [ ] If grace period is enabled, keep Pro access until grace expires.
- [ ] Notify in-app when Apple indicates billing issue.
- [ ] CTA should deep link to Apple billing management when possible.

### Google Play

- [ ] Use Google Play Billing Library in mobile app.
- [ ] Use Real-time Developer Notifications (RTDN) with Pub/Sub.
- [ ] On RTDN, backend must call Google Play Developer API to fetch current subscription state.
- [ ] Handle:
  - `SUBSCRIPTION_PURCHASED`
  - `SUBSCRIPTION_RENEWED`
  - `SUBSCRIPTION_CANCELED`
  - `SUBSCRIPTION_EXPIRED`
  - `SUBSCRIPTION_IN_GRACE_PERIOD`
  - `SUBSCRIPTION_ON_HOLD`
  - `SUBSCRIPTION_RECOVERED`
- [ ] During grace period, entitlement may remain active.
- [ ] During account hold, entitlement should be removed or degraded to Free.
- [ ] Google may show its own in-app messaging for payment issues; backend still keeps source of truth.

## Feature Gating UX

### Global UX

- [ ] Add `SubscriptionProvider` in the app shell.
- [ ] Load `/api/billing/entitlements` on app start.
- [ ] Cache short-lived entitlement state client-side.
- [ ] Revalidate on route changes and after checkout.
- [ ] Add `FeatureGate` component.
- [ ] Add `UpgradeDialog`.
- [ ] Add `AiCreditMeter`.

### Free Navigation

- [ ] Free users see all nav items, but locked items have lock/badge.
- [ ] Clicking locked nav item opens upgrade dialog instead of route.
- [ ] Notes and BalysAI remain accessible.
- [ ] Pricing CTA:
  - "Desbloquear Pro"
  - "Tudo do Flow Me + IA ilimitada"
  - Monthly and annual options.

### Route Protection

- [ ] Server/API route guards for paid features.
- [ ] Client route gates for UX.
- [ ] Never rely only on client gating.
- [ ] Protected API calls return:
  - `402 PAYMENT_REQUIRED`
  - `FEATURE_LOCKED`
  - `required_plan: pro`
  - `upgrade_url` or `checkout_available: true`
- [ ] Balys tools check entitlements before executing paid actions.

### AI Credit Exhaustion

- [ ] When Free user has 0 credits:
  - Balys input remains visible.
  - Send is disabled or opens upgrade dialog.
  - Message: "Seus créditos de IA de hoje acabaram. Eles renovam amanhã, ou você pode liberar IA ilimitada com Pro."
  - CTA: "Fazer upgrade para Pro."
- [ ] If a prompt would exceed remaining credits:
  - Show preflight warning for expensive actions.
  - Example: "Essa ação usa 4 créditos; você tem 2."
- [ ] If usage fails mid-request:
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

- [ ] In-app notification banner.
- [ ] Push notification.
- [ ] WhatsApp message if connected.
- [ ] Optional email later.

### Stripe Site Subscription

- [ ] `invoice.payment_failed`:
  - In-app: persistent billing banner.
  - Push: "Não conseguimos renovar sua assinatura Flow Me Pro."
  - WhatsApp: concise payment update message with secure link to billing portal.
- [ ] `invoice.payment_action_required`:
  - In-app/push/WhatsApp with authentication CTA.
- [ ] Recovery:
  - Clear banner after `invoice.paid`.

### Apple/Google In-App Purchase

- [ ] Apple:
  - Use App Store Server Notifications for backend state.
  - In-app text explains Apple handles payment update.
- [ ] Google:
  - Use RTDN + Play Developer API for backend state.
  - In-app text explains Google Play handles payment update.
- [ ] For mobile billing failures, CTA should open store subscription management, not Stripe.

## Support Section

### Product Surface

- [ ] Add route `app/app/support/page.tsx`.
- [ ] Add sidebar item "Suporte".
- [ ] Support page layout:
  - Balys support chat as primary panel.
  - Quick questions grid.
  - Account/billing state card.
  - Recent support requests/cancellation requests if any.
- [ ] Support Balys should not execute destructive account changes directly.
- [ ] Support Balys can create support/cancellation requests in DB.

### Support Knowledge Base

- [ ] Create `lib/support/knowledge-base.ts`.
- [ ] Create structured KB sections:
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
- [ ] Support Balys prompt must:
  - Use KB first.
  - Answer in user's language.
  - Avoid hallucinating policies.
  - Give step-by-step support.
  - Offer human escalation when billing/account risk exists.

### Quick Questions

- [ ] Add quick question buttons:
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
- [ ] Clicking a quick question injects and sends the prompt immediately.
- [ ] Quick questions should be localized later.

### Support API

- [ ] `POST /api/support/chat`
  - Support-only Balys route.
  - Injects support KB.
  - Lower-risk toolset.
  - Can open support tickets/cancellation requests.
- [ ] `GET /api/support/knowledge`
  - Optional admin/dev preview.
- [ ] `GET /api/support/requests`
  - User sees their own requests.

## Cancellation Funnel

### Trigger Detection

- [ ] Support Balys detects cancellation intent:
  - "cancelar"
  - "quero cancelar"
  - "cancela minha assinatura"
  - "não quero mais pagar"
  - "unsubscribe"
  - "cancel subscription"
- [ ] Do not immediately cancel.
- [ ] Start guided cancellation form.

### Required Questions

- [ ] Question 1:
  - "Qual o principal motivo do cancelamento?"
  - Minimum 100 characters.
- [ ] Question 2:
  - "Quais funcionalidades mais te decepcionaram?"
  - Minimum 10 characters.
- [ ] Question 3:
  - "Qual expectativa não foi atendida?"
  - Minimum 10 characters recommended.
- [ ] Question 4:
  - "Se um suporte humano te instruir melhor, você daria uma segunda chance?"
  - Required yes/no.
- [ ] Submit creates an open request.
- [ ] Do not auto-cancel until request is reviewed, unless product/legal decision later requires immediate self-service cancellation.

### Cancellation Database

- [ ] Create `subscription_cancellation_requests`:
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
- [ ] Add admin/dev query surface later.
- [ ] Add notification to owner/dev on new cancellation request.

### UX States

- [ ] If user abandons funnel:
  - Keep draft in local/session state.
- [ ] If request is open:
  - Show "Sua solicitação está em análise."
  - Offer support follow-up.
- [ ] If payment provider is Apple/Google:
  - Explain cancellation must be completed in App Store/Google Play if user wants immediate store-level cancellation.
  - Still collect feedback and create internal request.
- [ ] If provider is Stripe:
  - Internal request is enough for dev/support review.
  - Decide later whether to expose direct Stripe Portal cancellation.

## Admin/Internal Operations

- [ ] Add internal admin page later:
  - `/app/admin/billing` or Supabase-only initially.
- [ ] Admin capabilities:
  - View user entitlement.
  - View subscription provider/status.
  - View failed payments.
  - View cancellation requests.
  - Mark cancellation request status.
  - Add admin notes.
- [ ] Add daily admin alert:
  - New cancellation requests.
  - Failed payment notifications.
  - High AI cost users.

## Implementation Phases

### Phase 1 - Entitlements Foundation

- [ ] Migration for plans, prices, subscriptions, entitlements, billing events.
- [ ] Entitlement library.
- [ ] `/api/billing/entitlements`.
- [ ] Default Free entitlements.
- [ ] Tests for entitlement mapping.
- [ ] Route/API feature gates for obvious paid surfaces.

### Phase 2 - AI Credits

- [ ] `ai_credit_events` migration.
- [ ] Credit policy library.
- [ ] Credit meter API.
- [ ] Balys preflight for Free.
- [ ] AI usage instrumentation.
- [ ] Exhaustion UX.
- [ ] Tests for daily reset and credit consumption.

### Phase 3 - Stripe Web Billing

- [ ] Install/configure Stripe SDK.
- [ ] Env vars:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRO_MONTHLY_PRICE_ID`
  - `STRIPE_PRO_ANNUAL_PRICE_ID`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if needed.
- [ ] Checkout route.
- [ ] Portal route.
- [ ] Stripe webhook route.
- [ ] Local Stripe CLI webhook test.
- [ ] Checkout success/cancel pages or query states.
- [ ] Tests for webhook idempotency and entitlement changes.

### Phase 4 - Pricing and Upgrade UX

- [ ] Pricing page or modal.
- [ ] Upgrade CTA from locked routes.
- [ ] Upgrade CTA from credit exhaustion.
- [ ] Billing page in settings.
- [ ] Annual/monthly toggle.
- [ ] Stripe redirect.
- [ ] Post-checkout entitlement refresh.
- [ ] Tests for locked API responses.

### Phase 5 - Billing Failure Notifications

- [ ] In-app billing alert model.
- [ ] Push notification on Stripe failure.
- [ ] WhatsApp failure notification if connected.
- [ ] Billing Portal CTA.
- [ ] Recovery clearing on `invoice.paid`.
- [ ] Tests for notification event creation.

### Phase 6 - Support Section

- [ ] Support route/page.
- [ ] Support KB.
- [ ] Quick questions.
- [ ] Support chat route.
- [ ] Support request model.
- [ ] Billing-aware support answers.
- [ ] Tests for KB prompt and support route validation.

### Phase 7 - Cancellation Funnel

- [ ] Cancellation intent detector.
- [ ] Guided form state.
- [ ] Validation:
  - Reason min 100 chars.
  - Features min 10 chars.
  - Expectation required.
  - Second chance yes/no required.
- [ ] Cancellation request API.
- [ ] Open request status UI.
- [ ] Dev/admin notification.
- [ ] Tests for cancellation validation.

### Phase 8 - Mobile Billing Integration Contract

- [ ] Add provider-neutral receipt/subscription endpoints:
  - `POST /api/billing/apple/verify`
  - `POST /api/billing/google/verify`
  - `POST /api/webhooks/apple`
  - `POST /api/webhooks/google-play`
- [ ] Do not implement mobile app here, but prepare web backend contract.
- [ ] Document expected mobile payloads.
- [ ] Tests with mocked provider responses.

### Phase 9 - Observability and Reconciliation

- [ ] Billing reconciliation job:
  - Stripe subscription state vs local state.
  - Apple/Google state vs local state when applicable.
- [ ] AI cost dashboard.
- [ ] Alerts:
  - Webhook failures.
  - High AI cost.
  - Subscription state mismatch.
  - New cancellation request.
- [ ] Add runbook docs.

## Security and Compliance

- [ ] Use Stripe-hosted Checkout and Portal to minimize PCI scope.
- [ ] Verify Stripe webhook signature with raw body.
- [ ] Never store card data.
- [ ] Store provider customer/subscription IDs only.
- [ ] RLS:
  - Users can read their own subscription/entitlement/support request.
  - Users cannot write entitlement directly.
  - Service role/webhooks update billing state.
- [ ] Webhook idempotency for all providers.
- [ ] Avoid exposing technical provider IDs in user-facing UI.
- [ ] Support Balys must not reveal internal logs, secrets, or provider payloads.

## Open Product Decisions

- [ ] Exact Free daily credits:
  - Recommendation: start with 10/day.
- [ ] Whether Free can generate any images:
  - Recommendation: no at launch.
- [ ] Whether Stripe Portal allows direct cancellation:
  - Recommendation: initially route through support funnel, but confirm legal/store expectations before blocking self-service cancellation.
- [ ] Whether Pro "unlimited" has a visible fair-use note:
  - Recommendation: no visible cap; keep abuse controls internal.
- [ ] Whether annual plan has trial:
  - Recommendation: no trial initially; use Free as trial.
- [ ] Whether pricing is displayed as R$39,90/month annual or R$478,80/year:
  - Recommendation: show both.

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
- [ ] Support KB answers core product questions.
- [ ] Cancellation funnel enforces required minimums.
- [ ] Cancellation request persists for dev/admin review.
- [ ] Mobile provider subscription schema is ready for future app.

## Reference Notes

- Stripe Checkout supports hosted subscription checkout and helps minimize PCI scope through hosted payment collection.
- Stripe subscription webhooks such as `invoice.paid`, `invoice.payment_failed`, and subscription updates should drive local entitlement state.
- Apple subscriptions can enter billing retry; Apple attempts renewal for up to 60 days, and apps can optionally offer grace period.
- Google Play subscriptions use RTDN; backend must call Google Play Developer API after notifications to get the complete current subscription state. Google subscriptions may enter grace period and then account hold if unresolved.
