# Google Docs Connector

## User Promise

The Google Docs connector gives Balys account-wide access to discover, read, summarize, extract insights from, and edit Google Docs files the user can access. The user must not paste a document URL during connector setup.

## Expected Flow

1. Select the authorized `google_docs` connector from shortcut metadata, user wording, or `connectors.list`.
2. Use `connectors.search_docs` to list or search Docs files.
3. Resolve the target document by title and prior result context.
4. Use `connectors.read_doc` before summarizing or extracting insights.
5. Use `connectors.docs_agent` for edits after the target document is clear.

## Natural Requests That Must Work

- "/docs quais arquivos tem ai?"
- "lista meus documentos"
- "o que tem em Victor - Career Profile?"
- "resume o documento de isencao de IR"
- "edita o documento base e adiciona uma seção de riscos"

## UX Rules

- Connection form asks for type and display name only.
- Chat bubble shows the selected Docs shortcut/action after send.
- Balys must not ask "which connector?" when `/docs` was selected and one Docs connector is authorized.
- Balys must not ask for document URL or file ID.
- Lists should show user-facing names and useful dates, capped to a readable count.

## Tests

- Empty search query lists recent Docs files.
- Named follow-up resolves against the latest Docs search result.
- Read requires a resolved file ID internally, never from the user.
- Edit agent receives the resolved document file ID.
- Unauthorized messaging distinguishes inactive connector from failed token refresh.
