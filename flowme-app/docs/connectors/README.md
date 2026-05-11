# Balys Connector Standard

This is the product and implementation contract for Balys connectors. Connector UX is not a generic chat feature: a non-technical user expects "use Google Docs" or a selected `/docs` shortcut to work without knowing URLs, IDs, scopes, or tool names.

## North Star

Balys should behave like a capable assistant with access to the user's connected accounts:

- Connectors are account-wide capabilities, not one-off file links.
- The user names things naturally: "Victor - Career Profile", "my finance sheet", "that email from Anna".
- Balys resolves files, sheets, messages, and connector rows internally.
- A selected palette command is a deterministic instruction, not a hint the model may ignore.
- UI feedback must show which connector/action is attached before and after sending.

## Required Workflow

Every connector interaction follows this order:

1. Discover available connected sources with `connectors.list` when needed.
2. Select the obvious authorized connector from user intent, shortcut metadata, or prior context.
3. Search/list candidate files or messages.
4. Resolve the selected item by title, sender, date, or previous result context.
5. Read the actual content before summarizing, extracting insights, or editing.
6. Confirm the result in natural language without IDs, raw JSON, or internal tool details.

For Docs, Sheets, and Drive, discovery lists the user's files. The connection form must not ask for a document URL, spreadsheet URL, folder URL, or file ID.

Pasted Google links are valid input. If the user provides a Google Docs, Sheets, or Drive URL, Balys must read or edit from that URL directly instead of asking for a name or ID.

Google Docs has a dedicated Google Docs Editorial Agent for writing, creation, structure, style, and precise Google Docs API edits.

Google Sheets has a dedicated Google Sheets Financial Economist Agent for financial insight, layout-aware spreadsheet understanding, formulas, formatting intent, and precise Google Sheets API edits.

For Gmail, search results are only discovery metadata. If the user asks what an email says, why someone replied, or asks for insights from a specific email, Balys must read the body of the selected message before answering.

## Implementation Plan

### Phase 1: Make connector invocation deterministic

- Add a structured `selectedAction` or `connectorIntent` payload from `components/ai/CommandPalette.tsx` through `app/app/ai/page.tsx` into `app/api/ai/chat/route.ts`.
- Store the intent on the user message, not only in `systemAddendum`.
- In the API route, convert intent into routing constraints: preferred connector type, first required tool, and minimum step budget.
- For `/docs`, `/documentos`: first tool should be Docs discovery or Docs read if a prior selected document is already known.
- For Docs name/link requests: use `connectors.find_and_read_doc` so "leia o documento X" and pasted Docs URLs work in one intuitive step.
- For `/docs` creation requests: use `connectors.create_doc` after drafting polished content in the user's language.
- For `/planilhas`, `/sheets`: first tool should be Sheets discovery, sheet read, economist insight, or sheet edit depending on the request.
- For Sheets financial insight requests: use `connectors.sheets_agent` in analyze mode so the economist agent reads real sheet context and returns evidence-backed observations without modifying the sheet.
- For `/drive`: first tool should be Drive discovery/read.
- For `/gmail`: first tool should be Gmail search, followed by Gmail body read when content is requested.
- Add a resolver that can map follow-ups like "o que tem em Victor - Career Profile" to the last `connectors.search_docs` result.
- Prevent "which connector do you want?" when the palette action already identifies the domain and there is only one authorized connector of that type.

### Phase 2: Fix user-visible feedback

- Extend the `Message` model in `app/app/ai/page.tsx` with `selectedAction` and selected context labels.
- Render a small chip above or inside the sent user bubble, for example `Google Docs` or `/docs`.
- Persist the metadata to local storage and server-side thread messages so history remains understandable.
- Show running statuses in the existing thinking timeline using localized labels: discovering files, reading document, reading email body, editing sheet.
- Keep palette strings bilingual through `lib/i18n.ts`; visible UI text must support English and Portuguese.

### Phase 3: Add Gmail body reading

- Add `gmail.read_message` in `lib/ai/tools/connectors-tools.ts`.
- Add `readEmailMessage` in `lib/google/google-gmail.ts`.
- Fetch message with `format: full`, decode MIME parts, prefer `text/plain`, fall back to sanitized `text/html`, include useful headers and attachment metadata.
- Keep `gmail.search_messages` as discovery only: subject, sender, date, snippet, ids for internal follow-up.
- Chain search -> read when the user asks about the content of a specific email.
- Never answer content questions from a snippet alone.

### Phase 4: Reduce step-limit failures

- Raise or reserve step budget for connector workflows that require list -> search -> read -> final answer.
- Add deterministic short-circuit handling for simple connector commands:
  - "quais arquivos tem ai?" with `/docs` lists documents.
  - "o que tem em X?" after a list reads X.
  - "leia o email da Ana sobre contrato" searches Gmail and reads the top unambiguous result.
- Log connector intent, selected connector type, selected tool chain, and failure reason in production logs without exposing secrets.

### Phase 5: Test the leigo paths

Add tests for the exact behavior a regular user expects:

- Palette command metadata survives send and is visible on the sent bubble.
- `/docs quais arquivos tem aqui` invokes Docs discovery.
- Follow-up `o que tem em Victor - Career Profile` reads the matching document from prior results.
- Connected connector is not reported as unauthorized unless the linked account/token check actually fails.
- Gmail body read decodes plain text and HTML MIME bodies.
- Gmail content questions never answer from snippets only.
- Portuguese UI language renders Portuguese shortcut labels and status text.

## File Map

- Chat UI and sent-message feedback: `app/app/ai/page.tsx`
- Command palette actions: `components/ai/CommandPalette.tsx`
- Chat API and routing handoff: `app/api/ai/chat/route.ts`
- Routing heuristics: `lib/ai/shadow-router.ts`
- Tool loop and step behavior: `lib/ai/agent-loop.ts`
- Connector tools: `lib/ai/tools/connectors-tools.ts`
- Gmail API helpers: `lib/google/google-gmail.ts`
- Google OAuth and token refresh: `lib/google/google-auth.ts`
- UI translations: `lib/i18n.ts`

## Connector Docs

- Gmail: `docs/connectors/gmail.md`
- Google Docs: `docs/connectors/google-docs.md`
- Google Sheets: `docs/connectors/google-sheets.md`
- Google Drive: `docs/connectors/google-drive.md`
