# People (Contacts)

## Overview
Contact management for @mentions in notes. People are user-scoped contacts that can be referenced inside notes, creating a relational knowledge graph.

## Features
- **Contact book**: Name, email, avatar
- **@Mentions**: Reference people in notes via TipTap mention extension
- **Person notes**: Dedicated notes per person
- **Per-user**: Each user has their own people list (unique by name)

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/people` | GET | List all contacts |
| `/api/people` | POST | Create new person |
| `/api/people/[id]` | GET | Get person details |
| `/api/people/[id]` | PATCH | Update person |
| `/api/people/[id]` | DELETE | Delete person |
| `/api/people/myself` | GET | Get current user's own profile |

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `people` | `005_notes.sql` | Contact records |
| `note_mentions` | `005_notes.sql` | Note ↔ Person junction |
| `person_notes` | `006_person_notes.sql` | Person-specific notes |

### People Schema
| Column | Type | Purpose |
|---|---|---|
| `user_id` | UUID | Owner |
| `name` | TEXT | Contact name |
| `email` | TEXT | Contact email |
| `avatar_url` | TEXT | Profile picture |

## Key Files
| File | Purpose |
|---|---|
| `app/api/people/route.ts` | List + create |
| `app/api/people/[id]/route.ts` | Get + update + delete |
| `app/api/people/myself/route.ts` | Current user as contact |
