# Flow Me

**A personal AI assistant for turning chats, meetings, and scattered notes into calendar events and next steps.**

<img src="flowme-app/public/brand/flowme-logo-transparent.png" alt="Flow Me logo" width="96" />

Flow Me is built for people whose commitments are scattered across chats, meetings, email, and calendars. It brings tasks, goals, notes, documents, and connected accounts into one workspace. **Balys**, the in-app assistant, uses that context to find information and help with the next step. This repository contains the web product, landing page, database schema, integrations, tests, and deployment configuration.

**Explore the code:** [Web app](flowme-app/app/) · [Balys and tools](flowme-app/lib/ai/) · [Tests](flowme-app/__tests__/)

![CI](https://github.com/VictorRayan/flowme-ai/actions/workflows/ci.yml/badge.svg)

> Active project: a fresh clone needs your own Supabase project and provider credentials. Some integrations and scheduled features require additional setup.

## What you can do

- **Plan and follow through:** calendar, tasks, checklists, goals, reminders, and weekly/monthly reviews.
- **Capture context:** rich notes, meeting recordings and summaries, documents, and personal knowledge views.
- **Ask Balys:** an assistant with tools for app data and supported Google, Slack, and WhatsApp workflows.
- **Connect other agents:** scoped API keys and REST endpoints under [`flowme-app/app/api/v1/`](flowme-app/app/api/v1/).
- **Use it as a product:** onboarding, subscriptions, support, and a separate landing page.

### A typical workflow

Capture a meeting decision in a note. Ask Balys, in ordinary language, to schedule the follow-up in a connected Google Calendar. Review the event and your other commitments in **Today**. You can also ask Balys to find a connected document or email by name; the app resolves the provider's technical IDs behind the scenes. Connected workflows require authorization, provider configuration, and the corresponding plan entitlement.

## Engineering highlights

- [AI request routing](flowme-app/lib/ai/shadow-router.ts) scores the work and chooses a model tier, fallback, and execution gates.
- [Connector tools](flowme-app/lib/ai/tools/connectors-tools.ts) let Balys work with authorized accounts while resolving human-readable references to files and messages.
- [External API](flowme-app/app/api/v1/) uses scoped keys so another agent can access selected Flow Me capabilities.
- [Billing providers](flowme-app/lib/billing/providers/) separate the checkout contract from Stripe and Asaas integrations.
- [SQL migrations](flowme-app/supabase/migrations/) define the PostgreSQL data model and row-level security; [Jest](flowme-app/__tests__/) and [Playwright](flowme-app/e2e/) cover server behavior and browser flows.

**Stack:** Next.js 16 · React 19 · TypeScript · MUI · Supabase · Gemini/OpenAI · Cloudflare R2 · Docker

## Development history

The imported commit history begins on April 7, 2026 and follows the project from the first app prototype through Balys tools, connectors, billing, the landing page, tests, and security work. [Browse the commits](https://github.com/VictorRayan/flowme-ai/commits/master/). This public repository was created later from that cleaned history.

## Run locally

You need Node.js 24, npm, and a Supabase project. Google OAuth is used for sign-in, so enable the Google provider in Supabase, register the Supabase callback URL with Google, and allow `http://localhost:3000/auth/callback` in Supabase's redirect URLs. The app's own Google connector uses a separate callback; see [`flowme-app/.env.local.example`](flowme-app/.env.local.example).

```bash
git clone https://github.com/VictorRayan/flowme-ai.git
cd flowme-ai/flowme-app
cp .env.local.example .env.local
npm ci
```

Fill in at least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Keep that file local. Add Google OAuth credentials for account linking; Supabase's Google provider configuration handles sign-in. Add AI, R2, Slack, WhatsApp, and billing credentials for the features you intend to use. The [production environment template](.env.production.example) lists the broader configuration surface.

The database schema lives in [`flowme-app/supabase/migrations/`](flowme-app/supabase/migrations/). Apply the numbered migrations to a **new, empty Supabase project in dependency order**, and review the SQL before running it. Some migrations share a numeric prefix, so order by the full filename and verify dependencies. `run_on_supabase_dashboard.sql` is a historical catch-up script for an existing database, not the fresh-install entry point. This repository does not yet provide a one-command database bootstrap.

Then run `npm run dev` and visit [http://localhost:3000](http://localhost:3000).

Run `npm test -- --runInBand` and `npm run build` from `flowme-app/` to verify the app. Optional integrations can require additional provider setup even if the base app builds.

For sample screens, create `demo@example.com` in Supabase Auth and review the [fictional workspace seed](flowme-app/supabase/seeds/product_demo_workspace.sql) before running it in the SQL Editor. Its identities and amounts are invented.

Slack and Gmail content is fetched through each provider's authenticated API. External message text remains untrusted data for Balys. WhatsApp webhooks require `EVOLUTION_WEBHOOK_SECRET` in the `x-flowme-webhook-secret` header and are claimed by provider message ID to suppress retries. This header is a shared secret, not a provider signature; protect it as a credential and rotate it if exposed. Slack sends and Gmail draft creation use a database claim to prevent repeat writes for the same request and payload. After an uncertain provider response, the app asks the user to check the destination before retrying.

## Deploy to the cloud

The repository includes Dockerfiles and Compose examples for a Linux host. Bring your own domains, Supabase project, and provider credentials. There is no hosted Flow Me environment or automatic deployment pipeline in this public repository.

1. Create a fresh Supabase project, apply the [migrations](flowme-app/supabase/migrations/) in full filename order, configure Google sign-in, and register the app's production callback URLs.
2. Point DNS for the app, landing page, and Evolution API to your host. Open ports 80 and 443 for Traefik. Copy the [environment template](.env.production.example) to `.env.production` on the host and replace every example domain and credential you plan to use. Keep `.env.production` out of Git.
3. From the repository root, validate and start the Compose stack:

   ```bash
   docker network create flowme-proxy
   docker compose --project-directory . --env-file .env.production \
     -f traefik/docker-compose.yml -f evolution-api/docker-compose.yml \
     -f flowme-app/docker-compose.yml -f flowme-lp/docker-compose.yml config --quiet
   docker compose --project-directory . --env-file .env.production \
     -f traefik/docker-compose.yml -f evolution-api/docker-compose.yml \
     -f flowme-app/docker-compose.yml -f flowme-lp/docker-compose.yml up -d --build
   ```

The app image embeds `NEXT_PUBLIC_*` values at build time, so rebuild after changing them. The Compose stack includes a cron worker; deploy only the services and integrations you have configured. Database migrations remain a separate step. See the component Compose files and [Traefik guide](traefik/README.md) for host-specific settings.

## Repository map

| Path | Purpose |
| --- | --- |
| `flowme-app/app/` | UI routes and API handlers |
| `flowme-app/lib/` | Domain logic and provider integrations |
| `flowme-app/supabase/migrations/` | PostgreSQL schema and RLS |
| `flowme-app/__tests__/`, `flowme-app/e2e/` | Jest and Playwright tests |
| `flowme-app/docs/` | Feature and architecture notes |
| `flowme-lp/` | Static landing page |
| `traefik/`, `evolution-api/` | Docker deployment examples |
| `.github/workflows/ci.yml` | Tests and type checking without deployment credentials |

## Contributing and security

Feedback is welcome in Issues. Before proposing a code change, read [`flowme-app/AGENTS.md`](flowme-app/AGENTS.md) for project conventions and test expectations, and check the license status below. Do not post credentials in a public issue.

Never commit `.env.local`, `.env.production`, provider keys, service-account JSON, or production data. Public `NEXT_PUBLIC_*` values are included in client bundles; never put private keys there. If a credential has ever been exposed, **rotate it at the provider** even after removing it from Git history.

**License:** No open-source license has been added yet. The code is visible for review; reuse and redistribution require the maintainer's permission until a license is chosen.
