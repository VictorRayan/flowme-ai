# Flow Me AI — Project Overview

## What is Flow Me?
A personal productivity platform that combines calendar management, rich note-taking, document knowledge base, and AI skills — all accessible via a web UI and a REST API for external AI agents.

## Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, MUI 5, TipTap |
| **Backend** | Next.js API Routes (App Router) |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **File Storage** | Cloudflare R2 (S3-compatible) |
| **AI** | Google Gemini, OpenAI GPT-4o |
| **Calendar** | Google Calendar API |
| **Auth** | Supabase Auth (Google OAuth) + API Keys |

## Feature Map

| # | Feature | Doc | Status |
|---|---|---|---|
| 01 | [Authentication](01-authentication.md) | Auth, OAuth, API Keys | ✅ |
| 02 | [Calendar](02-calendar.md) | Events CRUD, Google sync | ✅ |
| 03 | [Notes](03-notes.md) | Rich text, @mentions, search | ✅ |
| 04 | [Documents](04-documents.md) | R2 storage, AI summaries | ✅ |
| 05 | [Skills](05-skills.md) | AI skills CRUD for agents | ✅ |
| 06 | [External API](06-external-api.md) | v1 REST API, MCP discovery | ✅ |
| 07 | [AI Assistant](07-ai-assistant.md) | Balys chat, calendar skill | ✅ |
| 08 | [Linked Accounts](08-linked-accounts.md) | Multi-Google account | ✅ |
| 09 | [People](09-people.md) | Contacts, @mentions | ✅ |

## Project Structure
```
flowme-ai/
├── app/
│   ├── (auth)/              — Login/signup pages
│   ├── api/                 — Internal API routes (session auth)
│   │   ├── ai/              — Chat, models, spend
│   │   ├── auth/            — Google OAuth callback
│   │   ├── calendar/        — Events CRUD
│   │   ├── documents/       — Upload, list, search, detail
│   │   ├── linked-accounts/ — Account management
│   │   ├── events/ — Flowme-native local events
│   │   ├── notes/           — Notes CRUD
│   │   ├── people/          — Contacts CRUD
│   │   └── v1/              — External API (API key auth)
│   │       ├── calendar/    — Events for AIs
│   │       ├── documents/   — Documents for AIs
│   │       ├── keys/        — API key management
│   │       ├── mcp/         — MCP discovery
│   │       ├── notes/       — Notes for AIs
│   │       └── skills/      — Skills CRUD
│   ├── app/                 — Protected app pages
│   │   ├── ai/              — AI chat UI
│   │   ├── calendar/        — Calendar UI
│   │   ├── notes/           — Notes UI
│   │   └── settings/        — Settings (API keys)
│   └── auth/                — Auth callback handler
├── components/
│   ├── ai/                  — Chat components
│   ├── calendar/            — Calendar views
│   └── notes/               — Note editor
├── lib/
│   ├── ai/                  — Billing, calendar skill, doc processor
│   ├── api/                 — Auth helpers, API key auth, error codes
│   ├── google/              — Calendar API, OAuth helpers
│   └── r2/                  — Cloudflare R2 storage client
├── supabase/migrations/     — Database migrations (000-011)
├── docs/                    — Feature documentation (this folder)
└── middleware.ts            — Route protection + session refresh
```

## Database Migrations (in order)
| # | File | Tables |
|---|---|---|
| 000 | `complete_setup.sql` | linked_accounts, microactivities, user_google_tokens, calendar_cache_events |
| 001 | `linked_accounts.sql` | (additions) |
| 002 | `microactivities.sql` | (additions) |
| 003 | `user_google_tokens.sql` | (additions) |
| 004 | `calendar_cache_events.sql` | (additions) |
| 005 | `notes.sql` | notes, people, note_mentions |
| 006 | `person_notes.sql` | person_notes |
| 007 | `note_embeddings.sql` | note embedding columns |
| 008 | `ai_usage_logs.sql` | ai_usage_logs |
| 009 | `api_keys.sql` | api_keys |
| 010 | `skills.sql` | skills, skill_executions |
| 011 | `documents.sql` | documents, document_links |

## Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# App
NEXT_PUBLIC_APP_URL=

# AI
OPENAI_API_KEY=
GEMINI_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```
