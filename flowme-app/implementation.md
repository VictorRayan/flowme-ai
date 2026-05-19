# Flowme-ai Implementation Plan

This file is the working source of truth for near-term implementation priorities. Read it before planning or changing application code.

## Current Priority: Balys Connectors

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

After the connector workflow is reliable, plan the reminders system. Treat reminders as a separate product track with its own schema, API routes, notification delivery model, UI states, and tests.
