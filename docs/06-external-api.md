# External API (v1)

## Overview
RESTful API for external AI agents (Claude, GPT, etc.) to interact with Flow Me. Authenticated via Bearer API keys with granular scope permissions.

## Authentication
```
Authorization: Bearer fm_aBcDeFgH...
```

Keys are prefixed with `fm_` and hashed with SHA-256 before storage. Each key has scoped permissions and optional expiry.

## MCP Discovery
```
GET /api/v1/mcp/discover
```
**Public endpoint** (no auth required). Returns the complete API specification including all tools, parameters, schemas, and usage examples. External AIs should call this first to understand available capabilities.

## API Key Management (Session Auth)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/keys` | GET | List all API keys (metadata only) |
| `/api/v1/keys` | POST | Create key → returns raw key **once** |
| `/api/v1/keys` | DELETE | Revoke key by `key_id` |

### Create Key
```json
POST /api/v1/keys
{
  "name": "Claude Desktop",
  "scopes": ["calendar.read", "notes.read", "notes.write", "skills.read"],
  "expires_in_days": 90
}
```

## Available Scopes

| Scope | Access |
|---|---|
| `calendar.read` | Read calendar events |
| `calendar.write` | Create/delete events |
| `notes.read` | Read/search notes |
| `notes.write` | Create/delete notes |
| `skills.read` | Read skills |
| `skills.write` | Create/update/delete skills |
| `documents.read` | Read documents + summaries |
| `documents.write` | Upload/delete documents |
| `*` | Full access |

## Complete Endpoint Map

### Calendar
| Endpoint | Method | Scope |
|---|---|---|
| `/api/v1/calendar/events` | GET | `calendar.read` |
| `/api/v1/calendar/create` | POST | `calendar.write` |
| `/api/v1/calendar/delete` | DELETE | `calendar.write` |

### Notes
| Endpoint | Method | Scope |
|---|---|---|
| `/api/v1/notes` | GET | `notes.read` |
| `/api/v1/notes` | POST | `notes.write` |
| `/api/v1/notes/[id]` | GET | `notes.read` |
| `/api/v1/notes/[id]` | DELETE | `notes.write` |

### Skills
| Endpoint | Method | Scope |
|---|---|---|
| `/api/v1/skills` | GET | `skills.read` |
| `/api/v1/skills` | POST | `skills.write` |
| `/api/v1/skills/[id]` | GET | `skills.read` |
| `/api/v1/skills/[id]` | PUT | `skills.write` |
| `/api/v1/skills/[id]` | DELETE | `skills.write` |

### Documents
| Endpoint | Method | Scope |
|---|---|---|
| `/api/v1/documents` | GET | `documents.read` |
| `/api/v1/documents` | POST | `documents.write` |
| `/api/v1/documents/[id]` | GET | `documents.read` |
| `/api/v1/documents/[id]` | DELETE | `documents.write` |

## Key UI
**Path:** `/app/settings/api-keys`

Web UI for managing API keys — create, view scopes/status, revoke. Built with MUI components.

## Key Files
| File | Purpose |
|---|---|
| `lib/api/api-key-auth.ts` | Bearer token validation + scope checking |
| `app/api/v1/mcp/discover/route.ts` | MCP discovery endpoint |
| `app/api/v1/keys/route.ts` | Key management (session auth) |
| `app/app/settings/api-keys/page.tsx` | Key management UI |

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `api_keys` | `009_api_keys.sql` | Hashed keys + scopes + metadata |
