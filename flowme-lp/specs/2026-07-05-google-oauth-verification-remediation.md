# Google OAuth Verification Remediation

Date: 2026-07-05

## Goal

Satisfy the Google Cloud OAuth verification follow-up for project `775297347877`
(`solar-program-347814`) by making Flow Me's public pages, privacy disclosure,
domain ownership, and consent test path easy for Google's reviewers to verify.

## Google Feedback To Resolve

- Homepage domain `https://flow-me.online` must be verified as owned by the
  Google Cloud project owner/editor in Google Search Console.
- Privacy policy must fully describe how Flow Me accesses, uses, stores, shares,
  protects, retains, and deletes Google user data.
- Privacy policy URL must not resolve to the same page as the homepage.
- OAuth consent flow for Google Docs, Gmail, Sheets, and Drive must be reachable
  by reviewers.

## Required Public Pages In `flowme-lp`

### 1. Homepage

Canonical URL: `https://flow-me.online/`

Files:

- `public/index.html`
- `public/pt-br/index.html`
- `public/en-us/index.html`

Approval purpose:

- Identify Flow Me as the submitted app/brand.
- Explain user-facing functionality before login.
- Link visibly to the same privacy policy URL configured in Google Cloud.
- Keep the root domain static and served by `flowme-lp`, not redirected to
  `app.flow-me.online`.

Acceptance criteria:

- `https://flow-me.online/` returns the LP home content with HTTP 200.
- The visible footer links to `/privacy` and/or `/privacidade`.
- The homepage URL configured in Google Cloud is exactly
  `https://flow-me.online/`.
- The domain appears in Google Cloud Authorized domains as `flow-me.online`.
- Google Search Console ownership is verified by an account that is also Owner
  or Editor on project `solar-program-347814`.

### 2. English Privacy Policy

Canonical URL for Google Cloud OAuth consent screen:
`https://flow-me.online/privacy`

File:

- `public/privacy.html`

Approval purpose:

- Give Google a distinct, responsive privacy policy URL.
- Disclose every category of Google user data Flow Me accesses and every action
  it may take on behalf of the user.

Required content:

- App/operator identity: Flow Me, Balys, Rayan Barbieri Consultoria em
  Tecnologia, CNPJ `49.858.359/0001-93`, support email.
- Google data accessed:
  - Calendar events and calendar metadata.
  - Gmail message metadata, message body content, draft creation capability if
    `gmail.modify` remains requested.
  - Google Docs document titles, metadata, content, create/edit/write actions.
  - Google Sheets spreadsheet titles, metadata, cell values, formulas,
    formatting context, read/write/edit/analyze actions.
  - Google Drive file and folder metadata, search results, and text-readable
    file content for user-requested files.
- Data use:
  - Only to power user-initiated Balys commands and requested assistant
    workflows.
  - No advertising, sale of data, cross-user profiling, or unrelated marketing.
- Data sharing:
  - No sale, rental, brokerage, or advertising disclosure of Google user data.
  - If Google content is sent to AI API providers to answer the user's command,
    name the provider categories and purpose.
  - State that transfers follow Google API Services User Data Policy and Limited
    Use requirements.
- Storage and protection:
  - OAuth tokens encrypted at rest.
  - HTTPS/TLS in transit.
  - Supabase/Postgres row-level isolation and user-scoped access controls.
  - Logs must not intentionally store Google content, tokens, or secrets.
- Retention and deletion:
  - Integration tokens are kept only while the connector/account is connected.
  - Disconnecting a connector deletes stored OAuth credentials for that
    connection.
  - Account deletion path and support email.
  - Deletion completion target of up to 30 days.
  - Users can also revoke access at `myaccount.google.com/permissions`.

Acceptance criteria:

- `https://flow-me.online/privacy` returns the privacy page, not the homepage.
- Page title and first heading clearly say it is a privacy policy.
- The policy includes the Google API Services User Data Policy / Limited Use
  statement.
- The disclosed scopes match the scopes actually requested in code and in Google
  Cloud. Current code requests `gmail.modify`; the policy must not claim only
  `gmail.readonly` unless the app code and consent screen are also reduced.

### 3. Portuguese Privacy Policy

Canonical user-facing URL: `https://flow-me.online/privacidade`

File:

- `public/privacidade.html`

Approval purpose:

- Provide the same Google user data disclosures in pt-BR for Brazilian users and
  paid traffic.

Acceptance criteria:

- Content has parity with `/privacy`.
- Footer/home links in pt-BR point to `/privacidade`.
- Any changes to English Google disclosures are mirrored here.

### 4. Terms Of Use

Canonical URLs:

- `https://flow-me.online/terms`
- `https://flow-me.online/termos`

Files:

- `public/terms.html`
- `public/termos.html`

Approval purpose:

- Support OAuth brand trust and paid checkout review.
- Explain Flow Me, app usage, subscriptions, integrations, AI limitations, and
  user responsibilities.

Acceptance criteria:

- Footer links remain visible from home and legal pages.
- Terms mention web app, Balys, connectors, Google services, and support contact.
- Terms do not contradict privacy data handling.

### 5. Domain Verification Artifact

Preferred method:

- Verify `flow-me.online` in Google Search Console via DNS TXT record.

Alternative method if DNS is inconvenient:

- Add the Google-provided HTML verification file under `flowme-lp/public/`.

Approval purpose:

- Prove homepage and privacy policy domain ownership for OAuth verification.

Acceptance criteria:

- Verification is completed using a Google account that is a Project Owner or
  Project Editor on `solar-program-347814`.
- If an HTML verification file is used, it is static, committed intentionally,
  and reachable at `https://flow-me.online/<google-verification-file>.html`.
- No production hot-edit is used for long-lived verification artifacts.

### 6. OAuth Reviewer Test Instructions

Public page:

- Do not publish reviewer credentials or private reviewer instructions in the LP.

Private response to Google:

- Provide the test account email/password or reviewer access path privately in
  the email or Cloud Console submission.
- Provide the exact workflow:
  1. Open `https://app.flow-me.online/login`.
  2. Sign in with the provided reviewer account or with Google if instructed.
  3. Go to `https://app.flow-me.online/app/connectors`.
  4. Click `Add connector`.
  5. Select Gmail, Google Docs, Google Sheets, or Google Drive.
  6. Click `Add & connect` / `Adicionar e conectar`.
  7. Continue through Google's OAuth consent screen.
  8. Confirm Flow Me returns to `/app/connectors` with the connector marked
     connected.
  9. Go to `https://app.flow-me.online/app/ai` and test natural commands such as
     `/gmail procure um email recente`, `/docs liste meus documentos`,
     `/planilhas quais planilhas tenho`, and `/drive procure arquivos recentes`.

Acceptance criteria:

- Reviewer account has Flow Me Pro or connector entitlement enabled, because the
  connector page gates this feature.
- OAuth redirect URI in Google Cloud matches the production callback used by the
  app.
- Consent screen shows requested scopes for Gmail, Docs, Sheets, Drive, and
  Calendar consistently with privacy disclosures.

## Implementation Checklist

- [ ] Confirm `flow-me.online` is verified in Google Search Console by a Project
  Owner/Editor.
- [ ] Confirm Google Cloud Authorized domains includes `flow-me.online`.
- [ ] Confirm OAuth consent homepage URL is `https://flow-me.online/`.
- [ ] Confirm OAuth consent privacy URL is `https://flow-me.online/privacy`.
- [ ] Confirm `/privacy` serves `privacy.html` with HTTP 200 and does not fall
  back to `index.html`.
- [ ] Confirm `/privacidade`, `/terms`, and `/termos` serve distinct legal pages.
- [ ] Align privacy disclosures with actual OAuth scopes, especially
  `gmail.modify` versus `gmail.readonly`.
- [ ] Mirror Google disclosure changes in English and Portuguese.
- [ ] Prepare private Google reviewer test instructions and reviewer account.
- [ ] Resubmit OAuth verification only after every item above is done.

## QA Plan

- Browser-check `390x844`, `768x1024`, `1024x768`, and `1440x900` for:
  homepage, `/privacy`, `/privacidade`, `/terms`, and `/termos`.
- Confirm no horizontal overflow or overlapping header/footer/legal text.
- Confirm legal links from the homepage footer resolve to the expected pages.
- Confirm `curl -I https://flow-me.online/privacy` returns HTTP 200 after
  deployment.
- Confirm `curl https://flow-me.online/privacy` contains privacy-specific text,
  not hero/homepage text.
- In production, test the OAuth flow with a fresh reviewer-like account before
  replying to Google.

## Regression Risks

- Nginx fallback may hide a missing legal page by serving `index.html`; check the
  returned body, not just HTTP status.
- The app can request a broader scope than the policy describes; keep code,
  consent screen, and policy synchronized.
- Reviewer accounts without Pro entitlement cannot reach connector consent flow.
- Publishing private reviewer credentials on a public LP page would create a
  security issue; keep credentials only in the private Google response.

## Predicted Google Follow-Ups

- Google may ask why Flow Me requests `https://www.googleapis.com/auth/gmail.modify`
  instead of narrower Gmail scopes. Current Flow Me behavior searches/reads
  messages and creates drafts, and the policy now discloses that exact behavior.
  If Google requests narrower scope proof, evaluate replacing `gmail.modify` in
  the app with the minimum Gmail scope set that still supports message body reads
  and draft creation.
- Google may ask for a demo video for restricted/sensitive scopes. The video
  should show the production app name, the Google OAuth consent screen in English,
  connector creation, Google consent, return to `/app/connectors`, and a real
  Gmail/Docs/Sheets/Drive command using the connected account.
- Google may ask for reviewer account access again. The reviewer account must
  already have Pro/connectors entitlement, otherwise the review cannot reach the
  OAuth consent path.
- Google may require exact Cloud Console values after deployment:
  homepage `https://flow-me.online/`, privacy policy `https://flow-me.online/privacy`,
  optional terms `https://flow-me.online/terms`, and authorized domain
  `flow-me.online`.

## Rollback Note

If legal copy causes confusion, revert only the privacy/terms content change and
keep the `/privacy` route distinct from the homepage. The distinct URL and domain
verification requirements are mandatory for Google verification and should not
be rolled back.
