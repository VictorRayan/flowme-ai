# Google Sheets Connector

## User Promise

The Google Sheets connector lets Balys discover spreadsheets, read ranges, understand layout and formatting intent, analyze rows, extract financial insights, manage formulas, and edit spreadsheets. It is account-wide; it is not tied to one spreadsheet URL.

Google Sheets work is handled by the Google Sheets Financial Economist Agent. The agent prompt is written in English for LLM compatibility, but user-facing insights must follow the user's language.

## Expected Flow

1. Select the authorized `google_sheets` connector from shortcut metadata, user wording, or `connectors.list`.
2. Use `connectors.search_docs` to list or search spreadsheet files.
3. Resolve the spreadsheet by title and prior result context.
4. Use `connectors.read_sheet` for simple range reads. The tool must accept a natural spreadsheet title, pasted URL, or resolved internal ID.
5. Use `connectors.sheets_agent` with `mode: "analyze"` for financial insights, expense diagnosis, trends, variance analysis, or recommendations. The tool must accept a natural spreadsheet title, pasted URL, or resolved internal ID.
6. Use `connectors.sheets_agent` with `mode: "edit"` for edits, formulas, row additions, cleanup, formatting-aware changes, and structural changes.

## Economist Agent Contract

- Reads real rows before giving financial opinions.
- Infers table layout, headers, totals, blank separators, dashboards, and where new data should belong.
- Preserves formatting intent: currency, percentages, dates, decimal precision, bold headers, background colors, alignment, frozen rows, and total rows.
- Produces evidence-backed insights for budgets, cash flow, fixed vs variable expenses, category concentration, anomalies, runway, trends, and budget-vs-actual variance.
- Edits precisely through Sheets API operations and avoids overwriting headers or formulas unless explicitly asked.

## Natural Requests That Must Work

- "/planilhas quais planilhas tem ai?"
- "abre minha planilha de gastos"
- "explica o que tem na Finance 2026"
- "explain what is on Finance 2026"
- "extrai os maiores custos do mes"
- "me da insights sobre meus gastos nessa planilha"
- "qual despesa esta ficando perigosa?"
- "adiciona essa despesa na planilha"
- "corrige a formula da coluna total"

## UX Rules

- Connection form asks for type and display name only.
- Chat bubble shows the selected Sheets shortcut/action after send.
- Balys does not ask for spreadsheet URL, range, sheet ID, file ID, or connector ID unless the user wants a very specific range and did not provide enough human context.
- A spreadsheet title like "Finance 2026" is sufficient. Resolve it internally with Drive search, exact-title match first, then the top relevant result if unambiguous.
- For analysis, Balys uses the economist agent and reads real rows before answering.
- For writes, Balys confirms destructive or ambiguous changes first.

## Tests

- Empty search query lists recent spreadsheets.
- `/planilhas` and `/sheets` both resolve to Sheets intent.
- Follow-up by spreadsheet title reads the selected file.
- Direct read/analyze by natural spreadsheet title resolves the internal file ID without asking the user.
- Analysis answers are based on `connectors.sheets_agent` insight receipts or `connectors.read_sheet` receipts for simple ranges.
- Edit tasks route to `connectors.sheets_agent` with the resolved file ID.
