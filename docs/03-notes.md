# Notes

## Overview
Rich-text note-taking system with TipTap editor, @mentions for people, date-based organization, and full-text search. Notes can be linked to calendar events and documents.

## Features
- **Rich text**: TipTap editor with bold, italic, underline, lists, headings, images
- **@Mentions**: Reference people (contacts) within notes
- **Date hierarchy**: Notes organized by date (year → month → day)
- **Event linking**: Attach notes to Google Calendar events
- **Types**: `manual`, `event`, `daily_briefing`
- **Soft delete**: Notes are never hard-deleted
- **Embedding support**: Vector embeddings for semantic search (migration 007)
- **Full-text search**: Search in `content_text` field

## Internal API (Session Auth)

| Endpoint | Method | Description |
|---|---|---|
| `/api/notes` | GET | List notes (filterable) |
| `/api/notes` | POST | Create a new note |
| `/api/notes/[id]` | GET | Get note with full content + mentions |
| `/api/notes/[id]` | PATCH | Update note (auto-clears embedding) |
| `/api/notes/[id]` | DELETE | Soft-delete |
| `/api/notes/search` | GET | Search notes |
| `/api/notes/similar` | GET | Semantic similarity search |
| `/api/notes/[id]/append` | POST | Append content to note |
| `/api/notes/[id]/embed` | POST | Generate embedding |
| `/api/notes/transcribe` | POST | Audio-to-text transcription |

### List Query Parameters
| Param | Description |
|---|---|
| `year` | Filter by year |
| `month` | Filter by month (requires year) |
| `person_id` | Filter by @mentioned person |

## External API (API Key Auth)

| Endpoint | Method | Scope | Description |
|---|---|---|---|
| `/api/v1/notes` | GET | `notes.read` | List with search + pagination |
| `/api/v1/notes` | POST | `notes.write` | Create note |
| `/api/v1/notes/[id]` | GET | `notes.read` | Get note detail |
| `/api/v1/notes/[id]` | DELETE | `notes.write` | Soft-delete |

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `notes` | `005_notes.sql` | Notes with TipTap JSON content |
| `people` | `005_notes.sql` | Contacts for @mentions |
| `note_mentions` | `005_notes.sql` | Note ↔ Person junction |
| `person_notes` | `006_person_notes.sql` | Person-specific notes |
| `note_embeddings` | `007_note_embeddings.sql` | Vector embeddings |

## Key Files
| File | Purpose |
|---|---|
| `app/app/notes/page.tsx` | Notes page (UI) |
| `components/notes/` | Editor, NoteList, etc. |
| `app/api/notes/*/route.ts` | Internal API routes |
| `app/api/v1/notes/*/route.ts` | External API routes |
