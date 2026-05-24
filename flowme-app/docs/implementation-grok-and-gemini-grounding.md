# Implementation — Grok in router + Gemini Grounding + OpenAI removal from chat

## Goal

- Add **xAI Grok** as a chat provider alongside Gemini, behind a feature flag.
- Add a **`web.grounded_search`** tool that uses the native Google Generative AI SDK with Search Grounding so Balys can answer questions about current events without leaving the agent loop.
- Add a **`trends.from_topics`** tool that calls Grok directly for real-time online conversation; results are sanitized so the end user never sees that the source is X.com.
- **Remove OpenAI from chat routing.** Keep it only for embeddings.

Embeddings stay on OpenAI for now (decision Victor 2026-05-24).

## Decisions captured

| # | Decision |
|---|---|
| Council mode | Gemini only — drop OpenAI fallback in `council-agents.ts` |
| Embeddings | Stay on OpenAI `text-embedding-3-small` — no migration |
| Grok delivery for chat | Feature-flag gated (`BALYS_ENABLE_GROK_CHAT`) — flag default off |
| Grounded search cost control | No per-call cache. Briefings precompute at `slot_time - 3min`; ad-hoc grounded calls from chat hit live each time |
| Trends source disclosure | Never reveal Twitter/X to end user. Sanitization regex strips @handles, t.co, x.com URLs |

## File plan

| Layer | New / Touched | Purpose |
|---|---|---|
| `lib/ai/shadow-router.ts` | touched | Add `Provider = 'openai' | 'gemini' | 'xai'`, Grok constants, flag-gated tier mapping |
| `lib/ai/agent-loop.ts` | touched | `provider === 'xai'` branch uses `https://api.x.ai/v1` + `XAI_API_KEY` |
| `lib/ai/council-agents.ts` | touched | Force Gemini-only model targets |
| `lib/ai/tools/web-tools.ts` | new | `webGroundedSearchTool` using `@google/generative-ai` native SDK |
| `lib/ai/tools/trends-tools.ts` | new | `trendsFromTopicsTool` calling Grok with `search_parameters: { mode: 'on', sources: [{ type: 'x' }] }` |
| `lib/ai/tools/registry.ts` | touched | Register both new tools |
| `BALYS.md` | touched | Document when to call grounded search and trends |
| `docker-compose.yml` / `deploy-production.yml` | touched | Wire `XAI_API_KEY` |
| `package.json` | touched | `@google/generative-ai` dep |
| Tests | new + touched | Cover Grok branch, grounded search shape, trends sanitization |

## Phases

### Phase 1 — Grok in router behind flag (this PR)
- Extend `Provider` union with `'xai'`.
- Add `GROK_STRONG = { provider: 'xai', model: 'grok-4' }` and friends.
- `hasProviderKey('xai')` reads `XAI_API_KEY`.
- New `featureFlags.enableGrokChat()` reads `BALYS_ENABLE_GROK_CHAT === 'true'`.
- When flag is on, tier-strong slots that today fall back to OpenAI use Grok instead.
- `agent-loop.ts` adds the xAI baseURL branch.
- `OPENAI_API_KEY` stays optional — still used for embeddings.
- Tests: router selects Grok when flag is on and key present; defaults to Gemini otherwise.

### Phase 2 — Grounded web search tool
- `npm i @google/generative-ai`
- New `webGroundedSearchTool` with input `{ query: string }`, returns `{ answer, citations: [{title, url, snippet}] }`.
- Uses `googleAI.getGenerativeModel({ model: 'gemini-2.5-flash', tools: [{ googleSearchRetrieval: {} }] })`.
- Wrap in try/catch — on failure returns `ok: false` with a plain message.
- Cache 5 minutes per query in-process Map (one hop per request lifecycle).
- BALYS.md: add usage rules — call for after-knowledge-cutoff facts, prices, news, today's date references.

### Phase 3 — Trends tool
- `trendsFromTopicsTool` input `{ topics: string[] }` max 3 topics.
- Calls Grok with system prompt directing it to summarize current online conversation per topic.
- Pass `search_parameters: { mode: 'on', sources: [{ type: 'x' }] }`.
- Returns `{ trends: [{topic, summary, signals: [{quote}]}] }`.
- Sanitization regex applied to every quote/text before returning: strip `@\w+`, `t\.co/\w+`, `x\.com/[^\s]+`.
- BALYS.md: describe as "current online buzz" — no mention of X/Twitter.

### Phase 4 — Remove OpenAI from chat
- Router tier mapping: drop `OPENAI_*` from all hot paths.
- `resolvePreferred(GEMINI_X, GROK_X)` instead of `(GEMINI_X, OPENAI_X)`.
- `buildFallbacks` returns Gemini and Grok variants only.
- `council-agents.ts` uses `GEMINI_STRONG` exclusively.
- Keep `hasProviderKey('openai')` only for the embeddings pipeline.

## Acceptance criteria

- Flag off → Balys behaves identically to today. No regression in 333 tests.
- Flag on, `XAI_API_KEY` set → strong-tier requests on web chat hit Grok. Logs show `model: grok-4`.
- `web.grounded_search` answers "qual a cotação do dólar hoje?" with at least 1 citation URL.
- `trends.from_topics` for "IA" returns 3 trends with no `@`, `t.co`, or `x.com` in any string field.
- Council deliberation runs only on Gemini.
- Notes search continues to use OpenAI embeddings (no regression).

## Risks

| Risk | Mitigation |
|---|---|
| Grok tool calling diverges from OpenAI schema | Conservative — first turn forced text-only response when flag on. Promote to tool calling after manual test. |
| Grounded search rate limit / cost spike | In-process cache + only briefings precompute |
| Trends sanitization misses something | Allowlist regex + max 280 chars per quote |
| OPENAI_API_KEY removed by mistake | Keep `OPENAI_API_KEY` required for embeddings — fail fast on boot if missing |

## Rollback

Each phase ships behind a flag or as additive code (new tool). Rollback = flip flag or unregister tool. No DB schema changes in this stream.
