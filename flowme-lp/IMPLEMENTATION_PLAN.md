# Flow Me LP Implementation Plan

Last updated: 2026-06-28

## Goal

Create a separate landing page application for the root domain `flow-me.online`, deployed on the same production server as the app, behind Traefik.

The web app remains on `app.flow-me.online`. The LP captures qualified leads, unlocks price after a short form, and then sends buyers to the app checkout.

## Deployment Shape

- [x] `flowme-lp/`: separate static landing page application.
- [x] `flowme-lp/Dockerfile`: Nginx image serving static files.
- [x] `flowme-app/`: existing authenticated app and checkout.
- [x] Traefik routes:
  - `flow-me.online` -> `flowme-lp`
  - `app.flow-me.online` -> `flowme-app`

## Copy Strategy

Use short and direct sentences. Keep the reading level simple. Favor concrete verbs and plain words.

Flesch-Kincaid direction:

- Short sentences.
- Clear sections.
- One idea per paragraph.
- Avoid jargon unless it is a known promise: "Jarvis pessoal".
- Use product outcomes before feature names.

## LP Structure

- [x] Hero: promise around personal Jarvis and execution.
- [x] Animated product structure inspired by SaaS landing motion.
- [x] Feature section covering Today, Goals, Calendar, Finance, Checklists, Notes, Review, BalysAI and Connectors.
- [x] WhatsApp/reminder section.
- [x] Coming soon section for mobile, WhatsApp filter, Telegram and Teams.
- [x] Testimonials for Victor and Leticia.
- [x] Final CTA with lead form.
- [x] Price hidden until lead form submission.
- [x] Checkout link shown only after unlock.

## Locale Strategy

- [x] `/pt-br`: Brazilian paid traffic.
- [x] `/en-us`: United States paid traffic.
- [x] Static app detects the prefix and swaps commercial copy, lead form placeholders, price and CTA.
- [x] Root `index.html` served by Nginx fallback in production.
- [x] Local static preview includes prefix loaders in `public/pt-br/` and `public/en-us/`.

## Product Proof Data

Create `demo@example.com` in Supabase Auth, then run the fictional demo seed in the SQL Editor:

```txt
flowme-app/supabase/seeds/product_demo_workspace.sql
```

It adds invented product studio income and expenses, launch notes, a goal and a checklist. All amounts and identities are examples.

## Lead Capture Checklist

- [x] Form requires name, email and WhatsApp.
- [x] Field-level validation feedback.
- [x] WhatsApp formatting while typing.
- [x] CSRF token requested from `app.flow-me.online`.
- [x] Lead POST sent to `flowme-app` marketing endpoint.
- [x] CORS allowlist enforced by backend.
- [x] Lead creates MQL record for the locale funnel.
- [ ] Add CRM/webhook delivery after validating traffic quality.

## Screenshot Checklist

Capture product proof for:

- [ ] `Hoje`: priorities, revenue block and market task.
- [ ] `BalysAI`: schedule-by-chat and finance council messages.
- [ ] `WhatsApp`: reminder confirmation and reminder delivery.
- [ ] `Checklists`: market checklist with checked and pending items.
- [ ] `Financas`: transactions, cuts and protected investments.
- [ ] `Metas`: yearly, monthly and weekly goals.
- [ ] `Calendario`: work and personal Google accounts with events.
- [ ] `Notas`: graph view with many links from tags, people and events.
- [ ] `Conexoes`: Gmail, Slack, Google Calendar and WhatsApp positioning.

## Admin Funnel Checklist

- [x] Landing visits by `pt-BR` and `en-US`.
- [x] MQLs by `pt-BR` and `en-US`.
- [x] Checkout visits by `pt-BR` and `en-US`.
- [x] Sales by checkout locale.
- [x] Pix issued by checkout locale.
- [x] Pix paid by checkout locale.
- [x] Card attempts by checkout locale and status.
- [x] Card failure message when provider error reaches backend.
- [x] Cards paid by checkout locale.
- [x] Revenue total by checkout locale.
- [x] Registered users with free/paid split.
- [x] Active users by hour and day.
- [x] Admin page at `/app/admin/marketing`.
- [x] Apply migration `063_marketing_funnel.sql` in Supabase before production use.

## Checkout

Primary checkout target:

```txt
https://app.flow-me.online/app/checkout
```

If the user is not authenticated, the app should handle login and return to checkout.

## Validation

- [x] Static page renders locally.
- [x] `/pt-br` and `/en-us` routes render locally.
- [x] Price is hidden until the lead form is submitted.
- [ ] Docker image builds.
- [ ] Compose config validates.
- [ ] Production CI builds/publishes `flowme-lp` image.
