# Flow Me LP Implementation Plan

Last updated: 2026-07-05

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

## Current Compliance Plan: Google OAuth Verification

Specification: `specs/2026-07-05-google-oauth-verification-remediation.md`

Goal: resolve the Google Cloud OAuth verification follow-up for project
`775297347877` (`solar-program-347814`) by proving domain ownership, keeping
homepage and privacy URLs distinct, expanding Google user data disclosures, and
giving reviewers a reachable OAuth consent workflow for Gmail, Google Docs,
Google Sheets and Google Drive.

### Required Public Pages

- [x] Homepage: `https://flow-me.online/`
  - File: `public/index.html`
  - Purpose: identify Flow Me, describe app functionality, and visibly link to
    the privacy policy configured in Google Cloud.
  - Requirement: must be static on `flow-me.online` and must not redirect to
    `app.flow-me.online`.
- [x] English privacy policy: `https://flow-me.online/privacy`
  - File: `public/privacy.html`
  - Purpose: canonical Google Cloud OAuth privacy URL.
  - Requirement: must disclose accessed Google data, data use, sharing,
    storage/protection, retention/deletion, revocation, and Limited Use.
- [x] Portuguese privacy policy: `https://flow-me.online/privacidade`
  - File: `public/privacidade.html`
  - Purpose: pt-BR parity for public users.
  - Requirement: must mirror the English Google user data disclosures.
- [x] English terms: `https://flow-me.online/terms`
  - File: `public/terms.html`
  - Purpose: public terms for app trust, subscriptions, connectors and support.
- [x] Portuguese terms: `https://flow-me.online/termos`
  - File: `public/termos.html`
  - Purpose: pt-BR parity for terms.
- [ ] Domain verification artifact, if DNS verification is not used.
  - File: Google-provided HTML verification file under `public/`.
  - Purpose: prove `flow-me.online` ownership in Search Console.
  - Requirement: the verifying Google account must also be Project Owner or
    Project Editor for `solar-program-347814`.

### Disclosure Fixes

- [x] Align privacy pages with the actual production OAuth scopes.
- [x] Resolve the current Gmail mismatch: code requests
  `https://www.googleapis.com/auth/gmail.modify`, while the public privacy page
  currently describes `gmail.readonly`.
- [x] Explicitly state whether Balys can create Gmail drafts. If `gmail.modify`
  remains requested, disclose message search/read plus draft creation and that
  Balys does not send email unless the product implements and discloses it.
- [x] Keep Docs, Sheets and Drive disclosures natural-user focused: users name
  files normally; Flow Me searches/resolves IDs internally.
- [x] State no sale, rental, brokerage, advertising disclosure or unrelated
  marketing use of Google user data.
- [x] State transfers to AI API providers only happen to fulfill user-initiated
  assistant commands and remain subject to Google API Services User Data Policy
  and Limited Use requirements.

### Google Cloud Console Updates

- [ ] Verify `flow-me.online` in Google Search Console from a Google account
  that is also Owner/Editor on the Google Cloud project.
- [ ] Add/confirm Authorized domain: `flow-me.online`.
- [ ] Set App homepage URL: `https://flow-me.online/`.
- [ ] Set Privacy policy URL: `https://flow-me.online/privacy`.
- [ ] Confirm Terms URL, if configured: `https://flow-me.online/terms`.
- [ ] Resubmit verification only after production URLs return the correct pages.

### Reviewer OAuth Test Path

Do not publish reviewer credentials in `flowme-lp`. Send them privately in the
Google email or Cloud Console verification notes.

- [ ] Prepare a reviewer account with Pro/connectors entitlement enabled.
- [ ] Confirm reviewer can open `https://app.flow-me.online/login`.
- [ ] Confirm reviewer can reach `https://app.flow-me.online/app/connectors`.
- [ ] Test `Add connector` -> Gmail -> `Add & connect` -> Google consent ->
  return to `/app/connectors` with connected status.
- [ ] Repeat for Google Docs, Google Sheets and Google Drive, or confirm that
  the shared Google linked account grants all requested scopes in one consent.
- [ ] Confirm `/app/ai` can demonstrate natural commands:
  `/gmail procure um email recente`, `/docs liste meus documentos`,
  `/planilhas quais planilhas tenho`, and `/drive procure arquivos recentes`.

### Verification Checklist

- [ ] `curl https://flow-me.online/privacy` contains the privacy policy heading,
  not the LP hero copy.
- [ ] `curl https://flow-me.online/privacidade` contains the Portuguese privacy
  policy heading.
- [ ] `curl https://flow-me.online/terms` and `/termos` contain terms headings.
- [ ] Footer legal links on `/`, `/pt-br`, and `/en-us` resolve to the expected
  legal pages.
- [ ] Browser QA at 390x844, 768x1024, 1024x768 and 1440x900 for legal pages.
- [ ] Production deploy goes through GitHub CI/CD; no long-lived production
  hot-edit for app code, Compose files or environment values.

## Current LP Refresh Plan: Personal Assistant And Reminder Proof

Specification: `specs/2026-07-06-personal-assistant-reminders-faq-testimonials.md`

Goal: simplify the public LP around Flow Me as the personal assistant that
centralizes WhatsApp, agenda, reminders, notes, finance, documents and work.

- [x] Update hero copy away from broad "conselho de especialistas" language.
- [x] Add the second fold: `Nunca mais esqueca um compromisso`.
- [x] Show WhatsApp reminder notifications on a lock-screen phone mockup.
- [x] Move the `Em breve` fold below higher-intent proof and FAQ content.
- [x] Replace testimonial SVG avatars with real testimonial photos.
- [x] Reduce testimonial fold height for faster section transition.
- [x] Add FAQ answers for Slack, Google Docs, Drive, Sheets, finance, reminders,
  WhatsApp and notes.
- [x] Run Flesch-Kincaid style readability audit and pair it with concrete copy
  checks.

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
- [x] Add dedicated finance fold.
- [ ] Add FAQ.

Test checklist:

- [ ] Full-page desktop screenshot.
- [ ] Full-page mobile screenshot.
- [ ] Links and CTAs from every fold.
- [ ] No console errors.
- [x] No horizontal overflow.

### 7. Design System Refresh: Meu Assessor Structure With Flow Me Colors

Goal: recover the pre-migration fine adjustments from the old React landing and align typography, borders and buttons with meuassessor.com while keeping the Flow Me palette.

Surface: `public/index.html` (head fonts), `public/styles.css`, `public/landing.js`.

Implementation checklist:

- [x] Load Poppins 300-700 via Google Fonts and make it the base font.
- [x] Headline pattern: h1 weight 400 with bold 700 orange `em` highlight (Meu Assessor headline rhythm, Flow Me orange).
- [x] Subheadline/paragraphs weight 300; heading weights mapped to 600/700 (no 800+ weights left).
- [x] CTAs: 20px radius, subtle 1px light border, purple/indigo gradient (pre-migration #4f46e5 base), double side glow and hover lift, Meu Assessor style with Flow Me colors.
- [x] Recovered pre-migration dot colors: green hero chip dot (#22c55e, 6px halo), purple gradient hero pills dots (#d946ef -> #8b5cf6), magenta footer proof dots (#d946ef).
- [x] Fixed locale copy wiping the green eyebrow dot (`setText` -> `setHtml` preserving `<span>`).
- [x] Section eyebrows restored to orange (pre-migration feature eyebrow color) and no longer overridden by paragraph rules.
- [x] Section bullets use green check circles (pre-migration CheckCircle style) instead of plain dots.
- [x] Plan buttons: green glow (44px halo) recovered, hover lift; locked price keeps orange glow behind blur.
- [x] Cards standardized on 14px radius (plan cards stay 20px); ticker text #e2e8f0 weight 500, slightly smaller, with pause on hover.
- [x] WhatsApp phone mock uses system font stack for realism.
- [x] Mobile h1 restored to ~41px (pre-migration scale).
- [x] Purple dot restored in hero body copy, separate from the headline.
- [x] Singularity uses colored Slack, Drive, Sheets and Docs icons while the proof slider keeps white official-looking logos.
- [x] Lower-left singularity orbit filled with Documentos so the ring has no empty quadrant.
- [x] Locked price blur strengthened and annual savings blurred before lead unlock.
- [x] WhatsApp hero chat starts populated earlier, scrolls faster and stays clipped below the WhatsApp header.

Test checklist:

- [x] 390x844, 768x1024, 1024x768, 1440x900: no horizontal overflow, no console errors.
- [x] Poppins active, h1 400/em 700 orange, green dot present, CTA radius 20px verified in computed styles.
- [x] Plans keep strong blur + green unlock buttons; annual savings stays blurred; LGPD present in ticker; footer, iPhone and singularity render.

Rollback note: revert the Google Fonts link and the styles.css typography/button block if conversion drops; dot colors and glows are standalone rules that can be reverted individually.

### 8. Finance By Conversation Fold

Goal: dedicated `#financas` fold modeled on Meu Assessor's second fold, showing expense capture by WhatsApp and the dashboard history.

Surface: `public/index.html` (new section after `#whatsapp`, nav/footer anchors), `public/styles.css` (finance gallery/slider block), `public/landing.js` (`setupFinanceSlider`, `finance` locale copy).

Implementation checklist:

- [x] Section copy: orange eyebrow "Controle financeiro", H2 "Anote seus gastos por áudio ou texto.", support text and 4 green-check bullets (WhatsApp query, auto categorization, daily summary, dashboard history).
- [x] Reuse the hero iPhone WhatsApp animation (same classes/keyframes, 35s cycle) with finance conversation: Uber R$45, iFood R$82, monthly total query and 21h daily summary.
- [x] Dashboard print slider below the split: 2 slides, arrows, dots, 6s auto-advance, pause on hover, stable 1.83:1 aspect ratio, per-slide captions.
- [x] Missing-image fallback shows the expected asset path until prints are saved.
- [x] Locale copy (pt-br/en-us) for eyebrow, title, text, bullets and captions.
- [x] Nav and footer "Financas" anchors point to `#financas`.
- [ ] Save real dashboard prints at `public/assets/financas-painel-1.png` (monthly dashboard) and `public/assets/financas-painel-2.png` (transactions/categories).

Test checklist:

- [x] Playwright render at 390x844, 768x1024, 1024x768, 1440x900: no horizontal overflow, no console errors (only expected 404s for the two pending prints).
- [x] Chat animation runs `chatScrollCycle`, typing bubbles fire, 8 bubbles render inside the phone bounds.
- [x] Slider dots/arrows navigate and fallback renders while prints are missing.
- [ ] Re-check slider crop on both viewports after the real prints are added.

Rollback note: remove the `#financas` section, the finance CSS block and `setupFinanceSlider()`/`finance` copy entries; nav/footer anchors revert to `#features`.

### 9. Agent Instruction And Spec Governance

Goal: make the LP execution process reproducible across agents and prevent regressions during future visual iterations.

Surface: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `specs/`.

Implementation checklist:

- [x] Make `AGENTS.md` the single canonical instruction source for the LP.
- [x] Make `CLAUDE.md` and `GEMINI.md` reference `AGENTS.md` only.
- [x] Add the UX -> P.O. -> frontend engineer -> QA Playwright -> P.O. -> frontend loop.
- [x] Require a versioned `specs/` file before changing shipped sections.
- [x] Require a whole-page Flesch-Kincaid style readability audit with concrete copy recommendations.

Test checklist:

- [x] Confirm `CLAUDE.md` and `GEMINI.md` do not fork implementation rules.
- [x] Confirm specs exist for this iteration.
- [ ] Re-run the spec checklist before every commit touching LP copy, layout or animation.

Rollback note: if the process becomes too heavy for small text edits, keep `AGENTS.md` as source of truth and mark specs optional only for non-shipped copy changes.

### 10. Notes Memory And Social Proof Refresh

Goal: add a premium memory/notes fold and convert social proof into an animated testimonial carousel with real roles and image slots.

Surface: `public/index.html`, `public/styles.css`, `public/landing.js`, `public/assets/testimonials/`.

Implementation checklist:

- [x] Add a notes and memory fold covering organization, project tracking, meeting recording, saved insights and WhatsApp consultation.
- [x] Add a knowledge graph demo showing Flow Me centralizing notes, meetings, files, people and tasks.
- [x] Add testimonial image slots for Victor and Leticia.
- [x] Add requested roles: Revenue Operations & Engenheiro de Software, Analista de CRM and Coordenador de Marketing.
- [x] Convert testimonials into an autoplay carousel with minimized side avatars, active center message, five stars and dots.
- [x] Keep the testimonial carousel deterministic for Playwright checks.

Test checklist:

- [ ] Desktop screenshot confirms the memory fold reads like a product proof section, not a generic card grid.
- [ ] Mobile screenshot confirms the graph and cards do not overflow.
- [ ] Carousel auto-advances, dots update and side cards show only images.
- [ ] Portrait assets load without broken images.

Rollback note: if the carousel hurts readability, keep the section content and replace absolute carousel positioning with a stacked card layout under 620px.

### 11. Hero WhatsApp Fidelity And Fold Pruning

Goal: make the hero WhatsApp mock look faithful to the reference and shorten the LP to the requested selling path.

Surface: `public/index.html`, `public/styles.css`, `public/landing.js`, `specs/2026-07-04-hero-whatsapp-and-pruned-folds.md`.

Implementation checklist:

- [x] Replace improvised WhatsApp/iPhone glyphs in the hero with SVG-style iOS status, video, phone, smile, camera and microphone icons.
- [x] Add a verified-style badge beside the Flow Me assistant name in the WhatsApp header.
- [x] Remove the folds for assistant organization, council, full product map, memory/notes, WhatsApp/reminders, finance and generic use cases.
- [x] Keep the testimonials section and remove the heading "Rotinas reais. Menos ruido."
- [x] Rework testimonials toward the Meu Assessor proof rhythm: proof stats, active quote, five stars and compact controls.
- [x] Update nav/footer anchors after removing sections.

Test checklist:

- [ ] Browser check at 390x844 and 1440x900 (blocked locally by Chromium sandbox/usage-limit approval).
- [x] Confirm removed fold copy no longer appears in `public`.
- [x] Confirm stale removed anchors no longer appear in `public`.
- [x] Confirm `landing.js` syntax and CSS brace balance.

Rollback note: restore the removed sections from git if the shorter LP underperforms; the WhatsApp icon fidelity changes can stay independently.
