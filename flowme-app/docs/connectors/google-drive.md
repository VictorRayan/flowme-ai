# Google Drive Connector

## User Promise

The Google Drive connector is the broad file discovery and read connector. It should help the user find files in Drive and read text-readable content without requiring a folder URL or file URL.

## Expected Flow

1. Select the authorized `google_drive` connector from shortcut metadata, user wording, or `connectors.list`.
2. Use `connectors.search_docs` to list or search Drive files.
3. Resolve the target file by name, type, date, and prior result context.
4. Use `connectors.read_drive_file` for readable files.
5. If a file is a Google Doc or Sheet and a specialized connector is available, prefer the specialized read/edit tool for deeper operations.

## Natural Requests That Must Work

- "/drive quais arquivos tem ai?"
- "procura o arquivo do contrato"
- "le esse PDF se der"
- "resume o arquivo de campanha"
- "acha os documentos sobre imposto"

## UX Rules

- Connection form asks for type and display name only.
- Chat bubble shows the selected Drive shortcut/action after send.
- Balys does not ask for Drive URL, folder ID, file ID, or connector ID.
- Discovery should include file names and types.
- If the file is not text-readable yet, explain plainly and suggest a supported file type or specialized connector.

## Tests

- Empty search query lists recent Drive files.
- Search can filter by user text.
- Read exports Google Docs/Sheets/Slides and downloads text files.
- Unsupported binary files produce a plain-language limitation.
- Follow-up by file name reads the matching latest result.
