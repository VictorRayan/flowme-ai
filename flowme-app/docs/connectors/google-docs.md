# Google Docs Connector

## User Promise

The Google Docs connector gives Balys account-wide access to discover, create, write, read, summarize, extract insights from, manage, and edit Google Docs files the user can access. The user must not paste a document URL during connector setup.

Google Docs work is handled by the Google Docs Editorial Agent. The agent prompt is written in English for LLM compatibility, but it must create and edit content in the user's requested language or the document's existing language.

## Expected Flow

1. Select the authorized `google_docs` connector from shortcut metadata, user wording, or `connectors.list`.
2. Use `connectors.search_docs` to list or search Docs files.
3. Resolve the target document by title and prior result context.
4. Use `connectors.create_doc` when the user wants a new Google Doc written from scratch.
5. Use `connectors.find_and_read_doc` when the user gives a Google Docs URL or asks to read a document by name.
6. Use `connectors.read_doc` before summarizing or extracting insights from an existing document when you already have the file id or URL.
7. Use `connectors.docs_agent` for edits after the target document is clear.

## Editorial Agent Contract

- Writes new document content when the user asks to create, draft, generate, or montar a document.
- Edits existing documents with awareness of audience, tone, structure, headings, writing quality, grammar, and style guides.
- Understands Google Docs API concepts: structural elements, paragraph styles, text styles, character indices, tables, named ranges, and batchUpdate request ordering.
- Preserves the author's voice and document formatting intent.
- Never fabricates missing facts, citations, legal claims, financial claims, or personal details.

## Natural Requests That Must Work

- "/docs quais arquivos tem ai?"
- "lista meus documentos"
- "o que tem em Victor - Career Profile?"
- "leia este link: https://docs.google.com/document/d/..."
- "abre o documento Victor - Career Profile"
- "resume o documento de isencao de IR"
- "cria um documento com um plano de aumento salarial"
- "escreve um briefing em Google Docs sobre a reuniao"
- "edita o documento base e adiciona uma seção de riscos"

## UX Rules

- Connection form asks for type and display name only.
- Chat bubble shows the selected Docs shortcut/action after send.
- Balys must not ask "which connector?" when `/docs` was selected and one Docs connector is authorized.
- Balys must not ask for file ID. If the user gives a Google Docs URL, use it directly.
- Lists should show user-facing names and useful dates, capped to a readable count.

## Tests

- Empty search query lists recent Docs files.
- Named follow-up resolves against the latest Docs search result.
- Pasted Google Docs URL reads the document directly.
- Natural document title reads the exact title match first, then the top search result.
- Read requires a resolved file ID internally, never from the user.
- Creation writes a new Google Doc through `connectors.create_doc`.
- Edit agent receives the resolved document file ID.
- Unauthorized messaging distinguishes inactive connector from failed token refresh.
