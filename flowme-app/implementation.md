# Flowme-ai Implementation Plan

This file is the working source of truth for near-term implementation priorities. Read it before planning or changing application code.

## Current Priority: Multi-provider Transparent Checkout

The active product track is the gateway-independent checkout described in
`docs/15-subscription-billing-support-implementation-plan.md` under
"Multi-provider Transparent Checkout". Implement the provider port, catalog
localization, Stripe Elements, Asaas Pix, normalized webhooks, and the checkout
experience before returning to the connector backlog.

The approved Checkout V2 remediation is specified in `docs/17-checkout-v2-implementation-plan.md`.
It uses client-side Card Elements tokenization, a persistent Pix/Card switch, server-side
IP country resolution for Pix, and mandatory tablet/mobile Playwright coverage.

For Asaas work, read `../.codex/skills/asaas-billing/SKILL.md` and its referenced
contracts before changing API calls, events, or entitlement transitions.

## Next Product Track: Support Experience

The bilingual Balys Support and controlled cancellation funnel is planned in
`docs/16-support-experience-improvement-plan.md`. It addresses invisible quick-question
responses, the required subscription-management/recurrence/cancellation progression,
detailed cancellation requests, manager review and provider execution, plan/revenue
history, localized errors, safe logging, responsive information hierarchy, and
pt-BR/en-US parity.

Implementation status: complete in code as of 2026-06-22. Deployment requires
`060_support_experience.sql`, manager role assignment, and final bilingual/mobile QA.

## Previous Priority: Balys Connectors

Balys connector behavior is product-critical. Before changing connector tools, chat commands, Google OAuth, Gmail, Docs, Sheets, Drive flows, or connector UI feedback, read:

- `docs/connectors/README.md`
- The connector-specific doc for the area being changed:
  - `docs/connectors/gmail.md`
  - `docs/connectors/google-docs.md`
  - `docs/connectors/google-sheets.md`
  - `docs/connectors/google-drive.md`

## Next Steps

1. Finish deterministic connector invocation.
   - Status: in progress. Structured command intent is now sent from the chat UI to the API, rendered on sent user messages, persisted in thread messages, and used to increase connector step budgets.
   - Pass structured connector intent from `components/ai/CommandPalette.tsx` through `app/app/ai/page.tsx` into `app/api/ai/chat/route.ts`.
   - Store the intent on the user message, not only in `systemAddendum`.
   - Convert intent into routing constraints: preferred connector type, required first tool, and connector-specific step budget.
   - Ensure palette commands such as `/gmail`, `/docs`, `/planilhas`, `/sheets`, and `/drive` are treated as deterministic workflow instructions.

2. Add Gmail body reading.
   - Status: implemented. `gmail.read_message` and `readEmailMessage` exist with MIME decoding tests.
   - Add `gmail.read_message` in `lib/ai/tools/connectors-tools.ts`.
   - Add `readEmailMessage` in `lib/google/google-gmail.ts`.
   - Fetch messages with `format: full`, decode MIME parts, prefer `text/plain`, fall back to sanitized `text/html`, and include useful headers and attachment metadata.
   - Keep `gmail.search_messages` as discovery only.
   - Never answer Gmail content questions from snippets alone.

3. Persist and display connector metadata.
   - Extend the chat message model in `app/app/ai/page.tsx` with selected connector/action metadata.
   - Render a small chip on sent user messages showing the selected action, such as `Google Docs`, `/docs`, or `/gmail`.
   - Persist metadata to local storage and server-side thread messages so history remains understandable.

4. Reduce connector step-limit failures.
   - Reserve enough tool-call budget for connector workflows that require list, search, read, and final answer.
   - Add deterministic short-circuit handling for simple connector commands:
     - `/docs quais arquivos tem aqui` lists documents.
     - `o que tem em Victor - Career Profile` after a list reads the matching document.
     - `/gmail leia o email da Ana sobre contrato` searches Gmail and reads the top unambiguous result.
   - Log connector intent, selected connector type, selected tool chain, and failure reason without exposing secrets.

5. Test regular-user connector paths.
   - Palette command metadata survives send and is visible on the sent bubble.
   - `/docs quais arquivos tem aqui` invokes Docs discovery.
   - Follow-up `o que tem em Victor - Career Profile` reads the matching document from prior results.
   - Connected connectors are not reported as unauthorized unless the linked account/token check actually fails.
   - Gmail body read decodes plain text and HTML MIME bodies.
   - Gmail content questions never answer from snippets only.
   - Portuguese UI language renders Portuguese shortcut labels and status text.

6. Run quality gates before considering connector work complete.
   - `npm test`
   - `npm run build`

## Later: Reminders

The provider-agnostic reminders architecture is planned in `docs/11-reminders-implementation-plan.md`.

Treat reminders as a separate product track with its own schema, API routes, notification delivery model, UI states, and tests. Reminders are notifications, not local tasks, microactivities, or "Flow me events".
