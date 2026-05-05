# Calendar

## Overview
Google Calendar-like interface with multi-account support, drag-and-drop events, Google Meet integration, and day/week/month views.

## Features
- **Multi-account**: Connect multiple Google accounts (work, personal)
- **Views**: Day, Week, Month with smooth navigation
- **CRUD**: Create, edit, delete events via Google Calendar API
- **Google Meet**: Auto-generate Meet links on event creation
- **Participants**: Add attendees with email
- **Flowme events**: Local-only events stored in Supabase legacy event storage
- **Drag-and-drop**: Reposition events in day/week views

## Architecture

```
User ↔ Calendar UI ↔ Internal API ↔ Google Calendar API
                                   ↔ Supabase (Flowme events)
```

## Internal API (Session Auth)

| Endpoint | Method | Description |
|---|---|---|
| `/api/calendar/events` | GET | List events (Google + Flowme events) |
| `/api/calendar/create-event` | POST | Create event via Google Calendar |
| `/api/calendar/edit-event` | PATCH | Update event via Google Calendar |
| `/api/calendar/delete-event` | DELETE | Delete event via Google Calendar |

### Query Parameters (GET)
| Param | Required | Description |
|---|---|---|
| `start` | ✅ | ISO date — range start |
| `end` | ✅ | ISO date — range end |
| `includeGoogleEvents` | — | `true` to fetch from Google |
| `includeFlowmeEvents` | — | `true` to include local Flowme events |
| `accountIds` | — | Comma-separated account UUIDs |
| `accountTypes` | — | Filter by account type (work/personal) |

## External API (API Key Auth)

| Endpoint | Method | Scope | Description |
|---|---|---|---|
| `/api/v1/calendar/events` | GET | `calendar.read` | List events |
| `/api/v1/calendar/create` | POST | `calendar.write` | Create event |
| `/api/v1/calendar/delete` | DELETE | `calendar.write` | Delete event |

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `linked_accounts` | `000_complete_setup.sql` | Google account connections |
| `user_google_tokens` | `000_complete_setup.sql` | OAuth tokens per account |
| `microactivities` | `000_complete_setup.sql` | Legacy storage table for Flowme events |
| `calendar_cache_events` | `000_complete_setup.sql` | Cached Google events |

## Key Files
| File | Purpose |
|---|---|
| `app/app/calendar/page.tsx` | Calendar page (UI) |
| `components/calendar/` | DayCell, WeekView, MonthView, etc. |
| `lib/google/google-calendar.ts` | Google Calendar API wrapper |
| `lib/google/google-auth.ts` | OAuth token management |
| `app/api/calendar/*/route.ts` | Internal API routes |
| `app/api/v1/calendar/*/route.ts` | External API routes |
