# Gmail Connector

## User Promise

The Gmail connector lets Balys find emails, open a specific email body, extract insights, and draft replies. It must not behave like subject-line search only.

## Expected Flow

1. Use `connectors.list` only when the active Gmail connector/account is unknown.
2. Use `gmail.search_messages` to discover candidate messages.
3. Resolve the selected message from sender, subject, date, snippet, or prior results.
4. Use `gmail.read_message` before answering any question about the message body.
5. Use `gmail.create_draft` only for drafts. Balys never sends email.

Follow-ups must preserve the previous result context. If Balys just listed "From Pedro Sobral, titled X" and the user asks "what is in Pedro Sobral?" or quotes that line back, Balys must read that selected message by internal id when available, or by natural sender/subject. It must not run a fresh narrower search that can return zero and contradict the message it already showed.

## Body Read Contract

`gmail.read_message` must return:

- `subject`
- `from`
- `to`
- `date`
- `body_text`
- `body_html` only if needed and sanitized
- `attachments` metadata, not attachment bytes by default
- internal `id` and `threadId` for follow-up only

The UI and Balys response must never show Gmail IDs.

## Natural Requests That Must Work

- "o que a Ana respondeu sobre o contrato?"
- "abre o email do banco de ontem"
- "qual foi o ponto principal desse email?"
- "procura o email da reunião e resume"
- "responde esse email dizendo que vou ver hoje"

## Failure Rules

- If search returns multiple plausible emails, ask by sender/subject/date, not by ID.
- If a prior result exists, do not say "I could not find it" until the body-read path has tried the prior message id or natural sender/subject from that result.
- If Gmail is connected in the UI but the tool cannot refresh the token, say the Google authorization failed and ask the user to reconnect only after the backend confirms the token was rejected or missing.
- If only snippets are available, do not pretend to know the full body.

## Tests

- Search returns metadata only.
- Read decodes single-part plain text.
- Read decodes multipart plain text.
- Read falls back from HTML to readable text.
- Follow-up after search reads the selected message body.
- Drafting a reply never sends the email.
