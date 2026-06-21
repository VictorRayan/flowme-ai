# Flowme-ai Monorepo Instructions

Before planning or changing application code, read `flowme-app/implementation.md` for the current implementation priorities and sequencing.

Before changing Asaas customers, Pix charges, subscriptions, webhooks, or billing-state mapping, read `.codex/skills/asaas-billing/SKILL.md` and its contract reference. Billing domain code must remain independent from Stripe and Asaas adapters.

The Next.js application now lives in `flowme-app/`. Follow `flowme-app/AGENTS.md` for all application code, tests, API routes, and Balys behavior.

Balys connector behavior is product-critical. Before changing chat commands, connector tools, Google OAuth, Gmail/Docs/Sheets/Drive flows, or connector UI feedback, read `flowme-app/docs/connectors/README.md` and the connector-specific docs under `flowme-app/docs/connectors/`.

Balys is built for non-technical end users. Connector work must never require users to know file IDs, document IDs, spreadsheet IDs, connector IDs, OAuth terms, or tool names; resolve natural names like "Finance 2026" internally through connector search and prior context.

Production deployment files are split by responsibility:

- `traefik/` reverse proxy and TLS entrypoint
- `evolution-api/` Evolution API, PostgreSQL, and Redis
- `flowme-app/` Flow Me app Docker and Compose config
- `.github/workflows/deploy-production.yml` CI/CD to the Hetzner host

Keep production secrets out of git. Use the root `.env.production.example` as the template for `/opt/flowme-ai/.env.production` on the server.

Production changes must go through GitHub CI/CD. Do not hot-edit production app code, Compose files, or long-lived environment values directly on the Hetzner server except for emergency diagnosis that the user explicitly approves. When production secrets or variables need to change, update GitHub repository/environment Secrets or Variables first, then let `.github/workflows/deploy-production.yml` write `/opt/flowme-ai/.env.production` during deployment so GitHub remains the source of truth.
