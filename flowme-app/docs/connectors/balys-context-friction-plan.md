# Balys Context And Connector Friction Plan

## Summary

Production tests showed that Balys can read Gmail when the flow is explicit, but loses connector context in common follow-ups and can silently skip Docs, Sheets, and Drive tool work. The primary issue is not model switching. The stronger causes are missing structured context, WhatsApp using only the latest message, production schema drift, and connector commands relying too much on model discretion.

## Production Findings

- Gmail listing works when asked directly: Balys called `gmail.search_messages` and listed recent inbox messages.
- Gmail body reading works in direct flows: Balys chained `gmail.search_messages` to `gmail.read_message`, and follow-up reading worked when the assistant had enough local context.
- Gmail follow-ups still create friction in real use: after listing a sender such as Pedro Sobral, Balys can run a fresh narrower search and claim it cannot find the email instead of opening the prior listed result.
- Docs, Sheets, and Drive command tests returned HTTP 200 with no tool calls and the empty fallback answer, which is a product failure for connector commands.
- Council mode worked and ran the expected multi-phase flow.
- Production logs showed `thread_messages.selected_action` missing from the live Supabase schema cache, even though the repo contains migrations for it.
- WhatsApp Balys passed only the latest incoming user message to the agent, so follow-ups like "what is in the content of the email?" had no prior email list or tool receipt to resolve.

## Root Causes

- Web chat kept some connector thinking state in browser storage, but server persistence did not store assistant thinking/tool receipts.
- WhatsApp did not load persisted thread messages before routing or running Balys.
- Tool receipts were not replayed into the prompt as hidden context, so Balys had to infer from visible prose or search again.
- Gmail body-read receipts were useful to the model but poor for observability, because production logs did not expose compact metadata such as subject, sender, date, and body length.
- Connector-intent prompts were advisory. A selected connector action did not force the first tool call, allowing Docs, Sheets, and Drive to complete with no connector work.
- Production deployment currently ships app code through CI/CD but does not automatically apply Supabase migrations.

## Implementation Checklist

- Persist compact assistant thinking/tool receipts server-side for connector operations.
- Hydrate web chat messages with persisted thinking so reloads and cross-device sessions keep connector context.
- Replay recent connector receipts as hidden prompt context for follow-ups. Include technical IDs only in hidden context and never in user-facing replies.
- Load recent WhatsApp thread history before routing and before running the agent loop.
- Persist WhatsApp assistant thinking/tool receipts so future WhatsApp follow-ups can resolve prior emails and files.
- Force the first tool for connector-intent turns:
  - Gmail listing uses `gmail.search_messages`.
  - Gmail read follow-ups with prior search context use `gmail.read_message`.
  - Docs listing uses `connectors.search_docs`; named reads use `connectors.find_and_read_doc`.
  - Sheets listing uses `connectors.search_docs`; analysis/editing starts with `connectors.sheets_agent`.
  - Drive starts with `connectors.search_docs`.
- Replace the empty "I finished but had nothing to add" fallback for forced connector turns with a plain connection/access failure message.
- Improve `gmail.read_message` receipts to store subject, sender, date, snippet, body length, and attachment count without raw body content.
- Apply production Supabase migrations, especially the thread message metadata columns, and refresh the PostgREST schema cache.

## Acceptance Criteria

- Web: "today mails" followed by "what is in Pedro Sobral mail?" opens the prior listed Pedro Sobral email body without asking for IDs, sender details, or a different date.
- WhatsApp: "O que tem na minha caixa de entrada hoje?" followed by "O que tem no conteúdo do email?" reads the previously listed email.
- Sheets: `/planilhas quais planilhas tem aqui?` lists spreadsheets, and a follow-up by spreadsheet title reads or analyzes the right file.
- Docs: `/docs quais documentos tem aqui?` lists documents, and a follow-up by document title reads the right file.
- Drive: `/drive quais arquivos tem aqui?` lists files when connected or plainly asks the user to connect Drive when no Drive connector exists.
- No connector command returns a successful empty response with zero tool calls.
- Production logs no longer show missing `selected_action`.
- Balys never exposes Gmail message IDs, file IDs, document IDs, spreadsheet IDs, connector IDs, OAuth terms, or internal tool names to end users.

## Production Rollout Notes

- Do not hot-edit production app code, Compose files, or long-lived environment values on the Hetzner server.
- Apply schema changes through the approved Supabase migration process before or alongside app deployment.
- Deploy app changes through GitHub CI/CD.
- After deployment, re-run the production E2E checks against `victorrayansouzaramos@gmail.com` and inspect app logs for connector failures.

## Local Verification Notes

- Local tests with `victorrayansouzaramos@gmail.com` showed Docs and Sheets listing can be made deterministic by pre-executing safe discovery tools for broad list requests.
- Drive must be strict: `/drive` should use a Drive connector only. If no Drive connector is connected, Balys should plainly ask the user to connect Drive instead of falling back to Sheets or Docs.
- Gemini can occasionally delay or fail before or after a tool call. Connector flows need deterministic fallbacks from successful tool receipts so a provider hiccup does not erase an already-read email, document, or sheet result.
- Portuguese natural phrases such as "o que chegou na minha caixa" and follow-ups such as "abre o primeiro documento" or "analisa a primeira planilha" need explicit routing, because broad-list keywords like "mostra" and "o que tem" can otherwise misclassify read/analyze follow-ups as fresh list requests.
- Local `.env.local` currently exposes an OpenAI quota issue; user-facing errors must hide raw provider quota links and use a simple temporary-unavailable message.
