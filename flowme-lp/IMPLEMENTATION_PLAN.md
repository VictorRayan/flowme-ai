# Flow Me LP Implementation Plan

Last updated: 2026-07-04

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
- [x] Public LP source of truth is `flowme-lp/public/**`.
- [x] `flowme-app/app/page.tsx` is app behavior only and redirects to `/login`.

## Copy Strategy

Use short and direct sentences. Keep the reading level simple. Favor concrete verbs and plain words.

Flesch-Kincaid direction:

- Short sentences.
- Clear sections.
- One idea per paragraph.
- Avoid jargon unless it is a known promise: personal assistant.
- Use product outcomes before feature names.

## LP Structure

- [x] Hero: promise around personal assistant and execution.
- [x] Animated product structure inspired by SaaS landing motion.
- [x] Feature section covering Today, Goals, Calendar, Finance, Checklists, Notes, Review, personal assistant and Connectors.
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
- [ ] Assistant: schedule-by-chat and finance council messages.
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

## Landing Execution Doctrine

This LP inherits the implementation method from `../flowme-app/AGENTS.md`, adapted to a static site:

- [x] Maintain an implementation plan before broad landing changes.
- [x] Use mobile-first layout for 390x844, 768x1024, 1024x768 and 1440x900.
- [x] Verify render states with browser screenshots.
- [x] Treat known-tool logos as product-critical. Slack, WhatsApp, Drive, Sheets, Calendar and similar brands must use original logos or official/original-looking variants.
- [x] Mock lead/pricing behavior with static fixtures or intercepted requests before relying on production endpoints.
- [x] Keep legal, footer, pricing and CTA links reachable on every viewport.

## Current Execution Plan: Flow Me Landing Refresh

### 0. Public LP Migration Boundary

Goal: guarantee the public landing served at `https://flow-me.online` comes from `flowme-lp`, not from the authenticated Next.js app.

Implementation checklist:

- [x] Keep Traefik root-domain routing on `flowme-lp`.
- [x] Move current hero/headline/first-fold proof to `flowme-lp/public/index.html`, `styles.css` and `landing.js`.
- [x] Make `flowme-app/app/page.tsx` redirect to `/login`.
- [x] Keep checkout and marketing APIs on `app.flow-me.online`.
- [x] Reinforce `AGENTS.md`, `GEMINI.md` and `CLAUDE.md` with LP ownership and mobile-first design-system rules.

Test checklist:

- [x] Static LP render check at 390x844, 768x1024, 1024x768 and 1440x900.
- [x] Next app build confirms `/` redirect compiles.
- [ ] Docker image builds for `flowme-lp` (not validated locally; Docker unavailable on this machine).
- [x] Verify Traefik compose still maps `flow-me.online` to `flowme-lp` and `app.flow-me.online` to `flowme-app`.

### 1. WhatsApp Animation

Goal: show the Assistant answering a real routine question, then scrolling to a training answer and reminder case.

Implementation checklist:

- [x] Extend the phone chat sequence with training and reminder examples.
- [x] Add internal chat scroll animation that resets cleanly.
- [x] Keep WhatsApp UI faithful: header, typing, bubbles, compose row and iPhone frame.
- [x] Keep animation inside first-fold phone bounds.

Test checklist:

- [x] Desktop screenshot shows the phone and active chat.
- [x] Mobile screenshot confirms no horizontal overflow.
- [x] Observe one full 35s cycle and confirm it resets.

### 2. Hero Micro-Points

Goal: simplify "Registre por audio", "Consulte em segundos" and "Organize tudo no painel" into premium proof points.

Implementation checklist:

- [x] Replace icon badges with small purple dots.
- [x] Keep text bold and readable on dark hero.
- [x] Preserve three-column desktop and stacked mobile layout.

Test checklist:

- [x] Desktop screenshot confirms icons are gone.
- [x] Mobile screenshot confirms touch/spacing remains readable.

### 3. Proof Slider Logos

Goal: make proof slider icons sophisticated and white on dark hero background.

Implementation checklist:

- [x] Use white official-looking Drive and Sheets variants in the proof slider.
- [x] Keep full-color official logos in detailed integration/product sections where inspection matters.
- [x] Preserve Slack official white variant.

Test checklist:

- [x] Browser render confirms white icons on dark background.
- [x] Confirm slider has no clipping at 390px.

### 4. Pricing Cards

Goal: restore locked pricing with blur and make plan differences explicit.

Implementation checklist:

- [x] Keep price blurred until unlock/checkout intent.
- [x] Use green unlock buttons.
- [x] List all core features in both plans.
- [x] Strike annual-only benefits on the monthly plan.
- [x] Highlight annual as the best value.

Test checklist:

- [x] Computed style confirms price blur.
- [x] Computed style confirms green button.
- [x] Mobile screenshot confirms long feature list fits.

### 5. Footer And Legal

Goal: provide a complete footer inspired by Meu Assessor while using Flow Me brand and legal content.

Implementation checklist:

- [x] Add Flow Me footer with product links, account links, proof bullets and CNPJ.
- [x] Add Privacy page.
- [x] Add Terms page.
- [x] Keep legal copy aligned with Flow Me behavior: AI, WhatsApp, app, checkout, integrations and LGPD.

Test checklist:

- [x] Footer links render.
- [x] Click privacy and terms links in browser.
- [x] Confirm CNPJ appears in footer and legal pages.

### 6. Narrative By Fold Based On Meu Assessor Scan

Goal: adapt Meu Assessor's conversion rhythm to Flow Me without copying its product scope.

Implementation plan:

- Fold 1: "Entre em flow com seu assistente pessoal no seu WhatsApp." with animated iPhone chat. Visual: current WhatsApp animation with typing, scroll, training and reminder.
- Fold 2: proof strip and singularity. Visual: integration singularity pulling WhatsApp, Slack, Drive, Docs, Sheets, bank, files, meetings, Calendar, checklist and goals into Flow Me.
- Fold 3: routine capture. Visual: voice/audio command becoming tasks, reminders and checklist.
- Fold 4: specialist council. Visual: premium panel showing risk, priority, next step and AI specialists.
- Fold 5: agenda and reminders. Visual: calendar timeline plus WhatsApp reminder confirmation.
- Fold 6: checklists and goals. Visual: checklist progress and goal milestones moving into the day.
- Fold 7: finance by conversation. Visual: transaction captured by WhatsApp and categorized in the dashboard.
- Fold 8: integrations. Visual: Slack/Drive/Sheets/Calendar logos connected to the Assistant with natural language search.
- Fold 9: plans. Visual: locked price cards, annual differential and green unlock CTA.
- Fold 10: FAQ/legal/footer. Visual: compact dark footer with product/account/support/legal.

Execution checklist:

- [x] Fold 1 implemented in `flowme-lp/public/index.html`.
- [x] Fold 2 implemented as singularity section.
- [x] Fold 9 implemented as locked plans.
- [x] Fold 10 footer/legal implemented.
- [ ] Add dedicated routine capture fold.
- [ ] Add dedicated premium specialist council fold.
- [ ] Add dedicated agenda/reminder fold.
- [ ] Add dedicated checklists/goals fold.
- [ ] Add dedicated finance fold.
- [ ] Add FAQ.

Test checklist:

- [ ] Full-page desktop screenshot.
- [ ] Full-page mobile screenshot.
- [ ] Links and CTAs from every fold.
- [ ] No console errors.
- [x] No horizontal overflow.
