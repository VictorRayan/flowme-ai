# Evolution API

This service runs Evolution API with private PostgreSQL and Redis containers. Only the API container joins Traefik's public network.

Required root `.env.production` values:

- `EVOLUTION_API_DOMAIN`
- `FLOWME_APP_DOMAIN`
- `EVOLUTION_API_IMAGE`
- `EVOLUTION_POSTGRES_DB`
- `EVOLUTION_POSTGRES_USER`
- `EVOLUTION_POSTGRES_PASSWORD`
- `EVOLUTION_AUTHENTICATION_API_KEY`

Use a URL-safe PostgreSQL password because it is interpolated into `DATABASE_CONNECTION_URI`.
