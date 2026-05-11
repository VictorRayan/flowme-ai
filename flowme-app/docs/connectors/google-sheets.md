# Google Sheets Connector

## User Promise

The Google Sheets connector lets Balys discover spreadsheets, read ranges, analyze rows, extract insights, and edit spreadsheets. It is account-wide; it is not tied to one spreadsheet URL.

## Expected Flow

1. Select the authorized `google_sheets` connector from shortcut metadata, user wording, or `connectors.list`.
2. Use `connectors.search_docs` to list or search spreadsheet files.
3. Resolve the spreadsheet by title and prior result context.
4. Use `connectors.read_sheet` for read/analysis tasks.
5. Use `connectors.sheets_agent` for edits, formulas, row additions, cleanup, and structural changes.

## Natural Requests That Must Work

- "/planilhas quais planilhas tem ai?"
- "abre minha planilha de gastos"
- "extrai os maiores custos do mes"
- "adiciona essa despesa na planilha"
- "corrige a formula da coluna total"

## UX Rules

- Connection form asks for type and display name only.
- Chat bubble shows the selected Sheets shortcut/action after send.
- Balys does not ask for spreadsheet URL, range, sheet ID, or connector ID unless the user wants a very specific range and did not provide enough human context.
- For analysis, Balys reads real rows before answering.
- For writes, Balys confirms destructive or ambiguous changes first.

## Tests

- Empty search query lists recent spreadsheets.
- `/planilhas` and `/sheets` both resolve to Sheets intent.
- Follow-up by spreadsheet title reads the selected file.
- Analysis answers are based on `connectors.read_sheet` receipts.
- Edit tasks route to `connectors.sheets_agent` with the resolved file ID.
