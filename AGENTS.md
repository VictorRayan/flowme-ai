# Flowme-ai Monorepo Instructions

The Next.js application now lives in `flowme-app/`. Follow `flowme-app/AGENTS.md` for all application code, tests, API routes, and Balys behavior.

Production deployment files are split by responsibility:

- `traefik/` reverse proxy and TLS entrypoint
- `evolution-api/` Evolution API, PostgreSQL, and Redis
- `flowme-app/` Flow Me app Docker and Compose config
- `.github/workflows/deploy-production.yml` CI/CD to the Hetzner host

Keep production secrets out of git. Use the root `.env.production.example` as the template for `/opt/flowme-ai/.env.production` on the server.
