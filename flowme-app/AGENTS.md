# Flowme-ai — Agent Instructions

## What this project is

A personal productivity platform ("Flow Me") that combines calendar management, rich note-taking, document knowledge base, AI skills, and tasks — accessible via a web UI and a REST API for external AI agents. The AI assistant is called **Balys**.

**Stack:** Next.js 16 · React 19 · MUI v5 dark theme · Supabase (PostgreSQL + RLS + Auth) · Cloudflare R2 · Google Gemini + OpenAI · TipTap editor · TypeScript strict mode

---

## TDD — non-negotiable

Every feature, route, and non-trivial pure function must have a test before or alongside the implementation. No exceptions.

### Test runner

```
npm test           # jest --no-coverage (fast)
npx jest --watch   # watch mode during development
```

Tests live in `__tests__/` mirroring the source tree:

| Source | Test |
|---|---|
| `lib/ai/billing.ts` | `__tests__/lib/billing.test.ts` |
| `lib/ai/shadow-router.ts` | `__tests__/lib/shadow-router.test.ts` |
| `lib/api/api-key-auth.ts` | `__tests__/lib/api-key-auth.test.ts` |
| `lib/api/errors.ts` | `__tests__/lib/errors.test.ts` |
| `app/api/notes/route.ts` | `__tests__/api/notes.test.ts` |
| `app/api/tasks/route.ts` | `__tests__/api/tasks.test.ts` |
| `app/api/connectors/route.ts` | `__tests__/api/connectors.test.ts` |
| `app/api/documents/route.ts` | `__tests__/api/documents.test.ts` |
| `app/api/people/route.ts` | `__tests__/api/people.test.ts` |
| `app/api/v1/keys/route.ts` | `__tests__/api/v1-keys.test.ts` |
| `app/api/linked-accounts/route.ts` | `__tests__/api/linked-accounts.test.ts` |

### Supabase mock pattern (thenable chain)

All API route tests mock `@/lib/api/auth` and use this exact pattern — do not deviate from it:

```typescript
function makeChain(listData: any[] = [MOCK_ITEM], singleData: any = MOCK_ITEM) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'limit', 'range', 'insert',
                   'update', 'delete', 'upsert', 'or', 'contains', 'ilike', 'gte', 'lte', 'in'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));
```

**Why:** Supabase query builder is a fluent chain that is also awaitable. Implementing `.then()` directly on the chain object means `await query` resolves at any point regardless of which methods were chained — no "terminal method" that breaks further chaining.

### What to test per route

For every API route test file, cover at minimum:
- **GET**: happy path returns expected shape; each filter/query-param accepted without error
- **POST**: happy path creates and returns data; each required-field missing → 400 VALIDATION_ERROR; invalid enum/type → 400
- **PATCH**: updates valid fields; empty body → 400 VALIDATION_ERROR
- **DELETE**: returns `{ ok: true, deleted: true }`

For pure functions (`lib/`): cover normal cases, edge cases (empty input, zero, unknown enum), and boundary values.

### Jest config notes

- `testEnvironment: 'node'` (not jsdom — avoids DOM setup overhead)
- `moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }` for path aliases
- Component tests (`__tests__/components/`) are excluded — they require `@testing-library/dom` which is not installed
- Config file: `jest.config.ts` (uses `next/jest.js`)

---

## Feature modules

Each feature is self-contained. Adding a new feature means touching these layers in order:

```
supabase/migrations/NNN_feature.sql   — schema first
app/api/feature/route.ts              — internal API (session auth)
app/api/feature/[id]/route.ts         — item-level operations
__tests__/api/feature.test.ts         — tests alongside the route
app/app/feature/page.tsx              — UI page
```

### Internal API conventions (`app/api/`)

All handlers follow this exact pattern:

```typescript
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  // ... query supabase ...
  return apiSuccess({ items });
}
```

- `requireAuth(request)` — throws `UNAUTHORIZED` if no session; returns `{ user, supabase }`
- `apiSuccess(data?, status?)` — `{ ok: true, ...data }` at status 200
- `apiError(code, message, status?)` — `{ ok: false, error: { code, message } }` at status 400

### External API conventions (`app/api/v1/`)

Use `requireApiKeyAuth(request, ['scope.action'])` from `lib/api/api-key-auth.ts`. Same `apiSuccess`/`apiError` shape.

### Validation rule

Always validate at the route boundary. Never trust body fields:
- Required strings: check for truthiness + trim
- Enums: check against an explicit `VALID_X` array defined at the top of the file
- Unknown enum values: either reject with `VALIDATION_ERROR` or default silently (document the choice in the test)

---

## Feature index

| # | Feature | Internal routes | External routes | Migrations |
|---|---|---|---|---|
| Auth | Login, OAuth, API keys | `app/api/auth/` | `app/api/v1/keys/` | `009_api_keys.sql` |
| Calendar | Google Calendar sync | `app/api/calendar/` | `app/api/v1/calendar/` | `000_complete_setup.sql` |
| Notes | Rich text, @mentions | `app/api/notes/` | `app/api/v1/notes/` | `005_notes.sql` |
| Documents | R2 storage, AI summaries | `app/api/documents/` | `app/api/v1/documents/` | `011_documents.sql` |
| Skills | AI skill CRUD | — | `app/api/v1/skills/` | `010_skills.sql` |
| AI / Balys | Chat, shadow router | `app/api/ai/` | — | `008_ai_usage_logs.sql` |
| Linked Accounts | Multi-Google account | `app/api/linked-accounts/` | — | `000_complete_setup.sql` |
| People | Contacts, @mentions | `app/api/people/` | — | `005_notes.sql` |
| Tasks | Microactivities, plans | `app/api/tasks/` | — | `015_tasks.sql` |
| Connectors | External data sources | `app/api/connectors/` | — | `014_connectors.sql` |

---

## AI routing — Shadow Router

**File:** `lib/ai/shadow-router.ts`

Every chat request is scored across four dimensions before a model is selected:

| Score | What it measures |
|---|---|
| `ambiguity` | How vague or relative the request is |
| `reasoning` | Complexity of reasoning required |
| `workflowLength` | Number of chained actions |
| `risk` | Potential for destructive actions |

`overallScore` → `tier` (cheap / mid / strong) → model selection from Gemini and OpenAI families.

Council (`taskType === 'council'`) gets a +0.30 reasoning boost because multi-perspective analysis is inherently high-reasoning even for short prompts.

---

## Key library files

| File | Purpose |
|---|---|
| `lib/api/auth.ts` | `requireAuth` + `getAuthUser` |
| `lib/api/errors.ts` | `apiSuccess`, `apiError`, `ErrorCode` enum |
| `lib/api/api-key-auth.ts` | `requireApiKeyAuth`, `generateApiKey` |
| `lib/ai/billing.ts` | `computeCostUsd`, `estimateTokensFromText`, `logAiUsage` |
| `lib/ai/shadow-router.ts` | Request scoring + model selection |
| `lib/ai/notes-skill.ts` | Notes AI skill |
| `lib/ai/council-agents.ts` | Multi-agent council pipeline |

---

## Coding rules

- **No comments explaining what the code does** — name things clearly instead
- **No error handling for impossible cases** — trust framework guarantees
- **No features beyond the task** — don't add abstractions for hypothetical future needs
- **Strict TypeScript** — no `any` in production code; `any` is acceptable only in test mock helpers
- **MUI v5 dark theme** — all UI uses MUI components, no Tailwind, no raw CSS beyond `globals.css`
- **Mobile friendly by default** — every page and component must work on mobile, tablet, and desktop with responsive MUI breakpoints, readable text, touch targets around 44px or larger, and no accidental horizontal overflow except intentional scrollable schedulers
- **Run tests after every change** — `npm test` must pass before considering a task done

---

## Balys AI — output rules

Balys is the user-facing AI assistant. Its output must feel like talking to a smart, concise human — not reading a database log.

- **Connector standard lives in docs** — before changing connector behavior, read `docs/connectors/README.md`. Then read the specific connector doc: `docs/connectors/gmail.md`, `docs/connectors/google-docs.md`, `docs/connectors/google-sheets.md`, or `docs/connectors/google-drive.md`.
- **Connector commands are structured intent** — `/gmail`, `/docs`, `/planilhas`, `/sheets`, `/drive`, and localized aliases are not decoration in the prompt. The UI and API must preserve them as explicit metadata, render them back to the user, and force the matching connector workflow.
- **Connectors are account-wide** — Google Docs, Sheets, and Drive connectors represent the authorized account/source, not one pasted file URL. Balys discovers files, lets the user refer to them by name, and resolves technical IDs internally.
- **Never expose IDs** — UUIDs, database row IDs, internal references must never appear in Balys responses. The user is a regular person.
- **Never ask the user for an ID** — when editing or referencing a note/event/email, resolve it internally using title + date hierarchy. If ambiguous, ask by name, never by ID.
- **Keep responses short** — confirm actions in one or two sentences. No bullet lists of "what I did". Just say "Done, I updated your note 'Meeting Notes'." and move on.
- **Use tools, don't hallucinate** — Balys must ONLY claim it did something if a tool returned a confirmed receipt. If no tool exists for the action, say so honestly.
- **Resolve references from context** — when the user says "that note", "this one", "the last one", use conversation history to determine which item they mean.
- **Tool receipts are internal** — the raw JSON from tool execution is for Balys to read internally. The user should see a natural language summary, never raw data.
