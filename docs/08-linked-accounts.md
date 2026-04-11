# Linked Accounts

## Overview
Multi-account Google integration. Users can connect multiple Google accounts (work + personal) and manage them independently. Each linked account stores its own OAuth tokens.

## Features
- **Multi-account**: Connect N Google accounts per user
- **Account types**: `work` or `personal` classification
- **Token management**: Access + refresh tokens stored per account
- **Active/inactive**: Toggle accounts without deleting
- **Soft delete**: Accounts can be deactivated

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/linked-accounts` | GET | List user's linked accounts |
| `/api/linked-accounts` | POST | Create new linked account |
| `/api/linked-accounts/[id]` | GET | Get account details |
| `/api/linked-accounts/[id]` | PATCH | Update account (name, type, active) |
| `/api/linked-accounts/[id]` | DELETE | Soft-delete account |

## Google OAuth Flow
```
User clicks "Connect Google Account"
  → /api/auth/google → Google consent
  → Callback with auth code
  → Exchange for access + refresh tokens
  → Store in user_google_tokens table
  → linked_account created
```

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `linked_accounts` | `000_complete_setup.sql` | Account metadata |
| `user_google_tokens` | `000_complete_setup.sql` | OAuth tokens per account |

### linked_accounts Schema
| Column | Type | Purpose |
|---|---|---|
| `user_id` | UUID | Owner (FK to auth.users) |
| `name` | TEXT | Account name (usually email) |
| `type` | TEXT | `work` or `personal` |
| `provider` | TEXT | Always `google` for now |
| `is_active` | BOOLEAN | Enable/disable |
| `is_deleted` | BOOLEAN | Soft delete flag |

## Key Files
| File | Purpose |
|---|---|
| `app/api/linked-accounts/route.ts` | List + create |
| `app/api/linked-accounts/[id]/route.ts` | Get + update + delete |
| `lib/google/google-auth.ts` | OAuth token refresh logic |
| `lib/google/google-calendar.ts` | Calendar API client (per account) |
