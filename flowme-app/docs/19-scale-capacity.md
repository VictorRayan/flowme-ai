# Flow Me scale and capacity notes

Last checked: 2026-07-11, production host `flow-me.online`.

This document estimates how many users the current production infrastructure can support and what will become the bottleneck first. It is an operational estimate, not a benchmark. The real number depends heavily on user behavior, provider quotas, Supabase plan limits, model latency, and WhatsApp/Evolution stability.

## Executive summary

Current production host:

- Host: `ubuntu-4gb-hel1-1`
- CPU: 2 vCPU
- RAM: 3.7 GiB + 2.0 GiB swap
- Disk: 38 GiB root volume, 8.5 GiB used, 28 GiB available
- App topology: one `flowme-app` container, one `flowme-lp`, one Traefik, one Evolution API, one Evolution Postgres, one Evolution Redis, one cron container
- Database for Flow Me product data: Supabase external service
- Evolution API data: local Postgres + Redis on the same 2 vCPU/4GB host
- Docker resource limits: none configured; all containers share the host CPU and memory pool

Practical answer today:

| Scenario | Current safe estimate | What fails first |
|---|---:|---|
| Logged-in users browsing app pages, notes, settings, checkout, calendar UI | 100–300 simultaneous light sessions | Next.js CPU, Supabase latency, browser polling/fetch bursts |
| Users actively chatting with Balys, mostly simple text | 10–25 simultaneous in-flight AI conversations | AI provider RPM/TPM and Node event-loop/CPU under streaming/tool orchestration |
| Users actively running connector/calendar/Gmail/Docs/Sheets workflows | 10–20 simultaneous workflows | Google Workspace API quotas, token refresh, Supabase query volume, AI tool-loop latency |
| Heavy workflows: meetings, image generation, council, long reviews, grounded search | 3–8 simultaneous heavy jobs | AI provider quotas/cost, memory spikes, cron/worker contention |
| WhatsApp conversations through the single Evolution instance | 5–15 simultaneous active conversations | WhatsApp session/Evolution reliability and AI provider latency |
| Daily active users if usage is sparse and mostly asynchronous | 500–1,500 DAU | Peak concurrency, provider quotas, support/ops burden |

Conservative business planning number: with the current single 2 vCPU/4GB server, plan for roughly **25–50 truly active users at the same time** if “active” includes Balys usage, and **100–300 simultaneous logged-in users** if most are just navigating/read-only.

If a launch/ad campaign may put 100+ people into Balys at once, the current architecture needs a queue/global rate limiter and likely a larger or horizontally scaled app tier before launch.

## Production snapshot

Read-only commands run against `root@flow-me.online`:

```bash
hostname
uname -a
nproc
free -h
df -h /
docker ps
docker stats --no-stream
docker inspect flowme-app evolution-api evolution-postgres
vmstat 1 5
```

Observed snapshot:

| Component | CPU | Memory |
|---|---:|---:|
| Host load average | 0.01, 0.03, 0.00 | 1.4 GiB used, 2.4 GiB available |
| `flowme-app` | ~2.4% | ~480 MiB |
| `evolution-api` | ~0.02% | ~207 MiB |
| `evolution-postgres` | ~0% | ~69 MiB |
| `evolution-redis` | ~1.3% | ~4 MiB |
| `traefik` | ~0% | ~20 MiB |
| `flowme-cron` | ~0% | ~7 MiB |

The server is currently idle. The risk is not current utilization; the risk is peak load from AI, external APIs, and one shared host with no container resource isolation.

## Current architecture constraints

### App server

`flowme-app` runs as a single Next.js standalone Node process:

- Docker image: `flowme-app/Dockerfile`
- Runtime command: `node server.js`
- One container, no replicas
- No CPU or memory limit in Compose
- Behind Traefik
- Product data is mostly external in Supabase

Because Node can handle many concurrent I/O waits, simple routes can scale decently on 2 vCPU. But AI requests are not just I/O; Balys tool orchestration, JSON parsing, prompt assembly, document parsing, memory recall, and streaming can consume CPU and memory. A few long concurrent requests can affect everyone.

### Cron and background jobs

`flowme-cron` calls app endpoints every minute for:

- briefings
- ritual prompts
- weekly/monthly reviews
- billing notifications
- meeting processing
- reminders/event check-ins
- connector health checks
- billing reconciliation
- stale thread summarization

Cron runs on the same app container and same 2 vCPU host. If background jobs run during a user spike, they contend with interactive Balys traffic.

### Evolution API

WhatsApp traffic uses:

- `evolution-api`
- local `evolution-postgres`
- local `evolution-redis`

This is on the same host. At low volume it is fine. At higher WhatsApp concurrency, Evolution can contend with the app for CPU/RAM and can create operational coupling: a WhatsApp issue can affect the main app host.

### Supabase

Flow Me’s main database is external. That helps the 4GB host because Postgres is not local for product data. The actual Supabase plan limits still matter:

- concurrent connections
- database CPU/IO
- API throughput
- storage egress
- function/RLS overhead

These cannot be inferred from this server. Check Supabase dashboard before any growth push.

## Internal product guardrails

The app has per-user Pro guardrails in `flowme-app/lib/billing/ai-guardrails.ts` and `.env.production.example`:

| Variable | Default |
|---|---:|
| `BALYS_PRO_REQUESTS_PER_MINUTE` | 30 per user |
| `BALYS_PRO_EXPENSIVE_CONCURRENCY` | 2 per user |
| `BALYS_PRO_EXPENSIVE_LEASE_SECONDS` | 900 |
| `BALYS_PRO_IMAGE_GENERATION_DAILY_LIMIT` | 10 per user/day |
| `BALYS_PRO_COUNCIL_DAILY_LIMIT` | 10 per user/day |
| `BALYS_PRO_WEB_GROUNDED_DAILY_LIMIT` | 30 per user/day |
| `BALYS_PRO_CONNECTOR_READ_DAILY_LIMIT` | 100 per user/day |
| `BALYS_PRO_BALYS_TOOL_DAILY_LIMIT` | 100 per user/day |
| `BALYS_PRO_MEETING_DAILY_LIMIT` | 5 per user/day |
| `BALYS_PRO_REVIEW_DAILY_LIMIT` | 6 per user/day |
| `BALYS_PRO_BRIEFING_DAILY_LIMIT` | 6 per user/day |

Important: these are **per-user** guardrails, not a global provider-protection queue. If 50 users run 2 expensive jobs each, the app can still attempt 100 concurrent expensive jobs. That is too much for the current single server and may exceed AI provider limits.

## External API limits that matter

These are account/project/tier dependent. Always confirm in the provider dashboard before launch.

### Google Calendar

Official Google Calendar API quotas currently document:

- 10,000 requests/minute/project
- 600 requests/minute/user/project

Source: <https://developers.google.com/workspace/calendar/api/guides/quota>

Calendar is unlikely to be the first global bottleneck unless Balys loops badly, deletes/updates in bulk, or many users sync aggressively at the same time.

### Gmail

Official Gmail API quotas use quota units:

- 1,200,000 quota units/minute/project
- 6,000 quota units/minute/user/project

Source: <https://developers.google.com/workspace/gmail/api/reference/quota>

Different Gmail methods cost different units. Reading/searching is usually manageable; sending or heavy mailbox scans can get expensive quickly.

### Google Sheets

Official Sheets API docs state per-minute quotas and provide the example of 300 read requests/minute/project.

Source: <https://developers.google.com/workspace/sheets/api/limits>

Sheets can become a bottleneck for repeated analysis if Balys reads many ranges or loops over files.

### Google Drive and Docs

Drive/Docs limits depend on the Google Cloud project and Workspace API quota model. Google notes Drive API quota changes around May 1, 2026 and account/project-specific quota behavior.

Source: <https://developers.google.com/workspace/drive/api/guides/limits>

Docs creation/editing also depends on Drive discovery and Docs batchUpdate calls. The real limit should be checked in Google Cloud Console quotas for the project.

### Gemini

Gemini API limits depend on model and billing tier, usually expressed as RPM, TPM, RPD, and related dimensions.

Source: <https://ai.google.dev/gemini-api/docs/rate-limits>

This is a likely bottleneck for Balys if Gemini is the primary model. Do not estimate production concurrency without checking the current project’s Gemini quota table.

### OpenAI

OpenAI rate limits are account/project/model dependent and typically include RPM and TPM.

Source: <https://developers.openai.com/api/docs/guides/rate-limits>

Flow Me should read rate-limit headers, log provider 429s, and back off/queue rather than allowing many users to hammer provider limits at once.

### WhatsApp / Evolution

Evolution API and WhatsApp behavior is not the same as a formally contracted WhatsApp Cloud API quota. Treat it as operationally fragile:

- one instance/session
- avoid high broadcast-like concurrency
- throttle responses
- monitor disconnects and message latency

## Capacity scenarios

### Scenario A — light app usage

Behavior:

- users log in
- browse Today/Calendar/Settings/Notes
- occasional CRUD
- few or no Balys requests

Estimated capacity:

- 100–300 simultaneous logged-in sessions
- More registered users are fine if they are not active at the same instant

Why:

- most data is externalized to Supabase
- Next.js static/page rendering is not the main bottleneck
- current host is idle

Risk:

- sudden fetch bursts
- Supabase plan/connections
- no app replicas

### Scenario B — normal Balys chat usage

Behavior:

- users send simple questions
- some memory/notes/calendar tools
- no large files/meetings/images

Estimated capacity:

- 10–25 simultaneous active Balys requests
- 50–100 active users over a rolling 5–10 minute window if requests are spread out

Why:

- AI provider latency keeps requests open
- tool loops increase route duration
- Node single-process orchestration can become sensitive under many long-lived requests

Risk:

- provider RPM/TPM
- streaming timeouts
- high p95 latency

### Scenario C — connector-heavy usage

Behavior:

- Gmail search/read
- Docs creation/editing
- Drive discovery
- Sheets analysis
- Calendar batch operations

Estimated capacity:

- 10–20 simultaneous connector workflows

Why:

- each user action can produce several Google API calls plus one or more model calls
- connector tools often need search → read → summarize/write

Risk:

- Google per-user quota
- Google project quota
- OAuth token refresh contention
- user-facing latency if one workflow spans many API calls

### Scenario D — heavy AI workflows

Behavior:

- meeting transcription/finalization
- image generation
- council
- weekly/monthly reviews
- web-grounded research

Estimated capacity:

- 3–8 simultaneous heavy jobs on current server

Why:

- the current guardrail limits expensive concurrency per user, not globally
- heavy jobs can hold leases for up to 900 seconds
- cron and user traffic share the same app server

Risk:

- AI provider RPD/RPM/TPM
- memory spikes
- long-running route timeouts
- cost spikes

### Scenario E — WhatsApp

Behavior:

- users talk to Balys through WhatsApp
- Evolution receives webhooks
- app calls AI and replies

Estimated capacity:

- 5–15 simultaneous active WhatsApp conversations
- Higher is possible only after load testing Evolution and adding throttling/queueing

Risk:

- Evolution session stability
- WhatsApp disconnects
- duplicate/retry webhooks
- provider latency causing delayed replies

## What “simultaneous active users” should mean

Use separate metrics:

1. **Concurrent sessions**: users with the app open.
2. **Concurrent HTTP requests**: requests in-flight at the same instant.
3. **Concurrent Balys requests**: AI route calls currently waiting on model/tool work.
4. **Concurrent expensive jobs**: meetings/images/council/reviews/web-grounded.
5. **Provider RPM/TPM usage**: actual Gemini/OpenAI quota consumption.
6. **Google Workspace quota usage**: per project and per user.

For Flow Me, metric 3 and 4 matter much more than metric 1.

## Current bottleneck ranking

Most likely bottlenecks, in order:

1. AI provider quotas/cost/latency.
2. Single app container on 2 vCPU under long AI/tool requests.
3. Missing global queue/rate limiter for expensive work.
4. Supabase plan limits under higher DAU.
5. Evolution/WhatsApp reliability under concurrency.
6. Disk space only later; current 28 GiB free is fine.

## Recommended monitoring before growth

Add or confirm:

- uptime monitoring for `flow-me.online`, `app.flow-me.online`, `evolution.flow-me.online`
- app p50/p95/p99 latency per route
- `/api/ai/chat` concurrent in-flight requests
- AI provider 429 count by provider/model
- AI provider latency and token usage
- Google API 401/403/429 by service
- Supabase query latency and connection usage
- container CPU/RAM over time
- Evolution webhook latency and disconnect events
- queue depth once a queue exists

Minimum server commands during a spike:

```bash
ssh -i ~/.ssh/hetzner-recovery root@flow-me.online
uptime
free -h
docker stats --no-stream
docker logs --tail=200 flowme-app
docker logs --tail=200 evolution-api
ss -s
```

Do not print production env vars during diagnostics; they contain secrets.

## Scale plan

### Phase 0 — safe current usage

Keep current infra if:

- fewer than 10 simultaneous Balys users
- fewer than 3 heavy jobs at a time
- no paid traffic spike
- CPU stays under 50% sustained
- memory available stays above 1 GiB
- provider 429s are rare

### Phase 1 — before ads or public launch

Implement:

- global AI request limiter across all users
- global expensive-job queue
- per-provider backoff and retry-after handling
- p95 route latency logging
- provider 429 alerting
- Docker resource limits so Evolution cannot starve the app
- move meeting processing to a dedicated worker or queue

Suggested current-host resource caps:

- `flowme-app`: reserve primary CPU/memory; cap around 2.5–3.0 GiB memory
- `evolution-api`: cap around 512–768 MiB
- `evolution-postgres`: cap around 512 MiB
- `redis`/`traefik`/`cron`: low caps

Exact Compose limits should be tested because Docker Compose resource syntax differs depending on mode.

### Phase 2 — vertical scale

Upgrade Hetzner when:

- 20+ simultaneous Balys users are common
- CPU is above 60% for 10+ minutes during normal usage
- memory available is below 700 MiB during peaks
- cron jobs noticeably slow interactive chat

Recommended next box:

- 4 vCPU / 8 GiB RAM
- 80+ GiB disk

Expected safe capacity after this, assuming provider quotas are raised:

- 50–100 simultaneous Balys conversations
- 300–700 simultaneous light sessions
- 10–20 simultaneous heavy jobs with a queue

### Phase 3 — horizontal scale

Add:

- 2+ `flowme-app` replicas behind Traefik
- sticky-independent stateless API behavior
- dedicated worker container for cron/jobs
- shared Redis/queue for global locks and job processing
- separate Evolution host if WhatsApp grows

At this point, the app tier is no longer the main limit; Supabase and AI provider quotas become the hard gates.

### Phase 4 — production-grade growth

For serious scale:

- managed Postgres/Supabase plan sized for workload
- background worker fleet
- durable queue
- autoscaling app tier
- multi-provider AI routing/fallback
- centralized logs/traces
- WAF/rate limiting at edge
- structured load tests before campaigns

## Load test plan

Do not use production user data. Create seeded test accounts and run staged tests.

Recommended tests:

1. **Light app test**
   - 100 virtual users
   - browse login-protected pages and fetch dashboards
   - target p95 below 800 ms for non-AI routes

2. **Balys simple chat test**
   - 10, 25, then 50 concurrent requests
   - mock AI provider first, then limited real-provider test
   - target p95 below 15 seconds for simple text

3. **Connector test**
   - 10 concurrent users
   - search/read Docs/Gmail/Sheets
   - watch Google 429/403 and token refresh errors

4. **Heavy job test**
   - queue 10 meetings/images/councils
   - verify queue behavior and no app-wide slowdown

5. **WhatsApp test**
   - 10 concurrent inbound conversations
   - watch Evolution stability, duplicate events, reply latency

## Immediate recommendation

Current infra is fine for private beta and early paid users, but I would not run paid acquisition into Balys-heavy usage without adding:

1. global AI provider rate limiting,
2. a queue for expensive jobs,
3. monitoring/alerts,
4. at least a 4 vCPU / 8 GiB server if campaigns are expected to produce bursts.

The product can probably support many registered users today because usage is bursty. The current risk is not total accounts; it is **how many people ask Balys to do work at the same minute**.
