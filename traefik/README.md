# Traefik

Traefik terminates TLS with Let's Encrypt HTTP-01 challenges and routes Docker services on the external `flowme-proxy` network.

Required root `.env.production` values:

- `FLOWME_APP_DOMAIN`
- `EVOLUTION_API_DOMAIN`
- `TRAEFIK_ACME_EMAIL`
- `TRAEFIK_LOG_LEVEL`

Ports `80` and `443` must be open on the server. The dashboard is disabled for production.
