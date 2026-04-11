# Authentication

## Overview
Flow Me uses **Supabase Auth** with **Google OAuth** as the primary identity provider. All protected routes require an active session.

## Auth Flow

```
User clicks "Sign in with Google"
  → Supabase OAuth redirect
  → Google consent screen
  → Callback to /auth/callback
  → Session cookie set
  → Redirect to /app/calendar
```

## Middleware
**File:** `middleware.ts`

- Runs on every request matching `/app/*`, `/login`, `/signup`, `/api/v1/*`
- Creates a Supabase SSR client to refresh session tokens via cookies
- Redirects unauthenticated users from `/app/*` to `/login`
- Redirects authenticated users from `/login` or `/signup` to `/app/calendar`
- V1 API routes (`/api/v1/*`) bypass cookie auth — they use Bearer API key auth

## Auth Helpers
**File:** `lib/api/auth.ts`

| Function | Purpose |
|---|---|
| `getAuthUser(request?)` | Returns `{ user, supabase }` or `null` |
| `requireAuth(request?)` | Throws `UNAUTHORIZED` if no session |

Supports both route handler path (with `NextRequest`) and Server Component path (using `next/headers` cookies).

## API Key Auth (External AIs)
**File:** `lib/api/api-key-auth.ts`

For external AI integrations (Claude, GPT, etc.), authentication uses Bearer tokens instead of cookies.

| Function | Purpose |
|---|---|
| `requireApiKeyAuth(request, scopes)` | Validates Bearer token + scope check |
| `generateApiKey()` | Generates `fm_` prefixed key (48 random chars) |

Keys are hashed with **SHA-256** before storage — raw key is only shown once at creation.

## Database Tables
- `auth.users` — Supabase managed user accounts
- `api_keys` — External API keys (migration: `009_api_keys.sql`)

## Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
```

## Routes
| Path | File |
|---|---|
| `/auth/callback` | `app/auth/callback/route.ts` |
| `/api/auth/google/*` | `app/api/auth/google/` |
| `/login` | `app/(auth)/login/page.tsx` |
| `/signup` | `app/(auth)/signup/page.tsx` |
