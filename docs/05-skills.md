# AI Skills

## Overview
Reusable AI processing instructions that external agents can create, retrieve, and execute. Skills define structured prompts with input/output schemas — like "functions" that any connected AI can call.

## Features
- **CRUD**: Create, read, update, delete skills
- **Versioning**: Auto-incremented version on updates
- **Categories**: general, calendar, notes, research, communication, automation, custom
- **Tags**: Searchable labels
- **Source tracking**: Who created the skill (user, system, or external_ai)
- **Schemas**: JSON Schema for expected inputs and outputs
- **Lookup by name**: Skills can be fetched by slug (`summarize_meeting`) or UUID
- **Execution log**: Audit trail of skill usage

## External API (API Key Auth)

| Endpoint | Method | Scope | Description |
|---|---|---|---|
| `/api/v1/skills` | GET | `skills.read` | List skills (filter by category, tag, search) |
| `/api/v1/skills` | POST | `skills.write` | Create a new skill |
| `/api/v1/skills/[id_or_name]` | GET | `skills.read` | Get skill by UUID or name |
| `/api/v1/skills/[id_or_name]` | PUT | `skills.write` | Update skill (auto-increments version) |
| `/api/v1/skills/[id_or_name]` | DELETE | `skills.write` | Soft-delete |

### Create Skill Example
```json
POST /api/v1/skills
{
  "name": "summarize_meeting",
  "display_name": "Summarize Meeting Notes",
  "description": "Takes raw meeting transcript and produces structured summary.",
  "instructions": "Given a raw transcript, produce: 1) Key decisions, 2) Action items, 3) Next steps.",
  "input_schema": {
    "type": "object",
    "properties": { "transcript": { "type": "string" } },
    "required": ["transcript"]
  },
  "category": "notes",
  "tags": ["meetings", "summary"],
  "source_agent": "claude-3-opus"
}
```

### Name Convention
Skill names must be: lowercase, alphanumeric with underscores, starting with a letter.
- ✅ `summarize_meeting`, `extract_action_items`, `daily_briefing_v2`
- ❌ `My Skill`, `123skill`, `skill--name`

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `skills` | `010_skills.sql` | Skill definitions + instructions |
| `skill_executions` | `010_skills.sql` | Execution audit log |

### Skills Schema
| Column | Type | Purpose |
|---|---|---|
| `name` | TEXT | Unique slug identifier |
| `display_name` | TEXT | Human-readable name |
| `instructions` | TEXT | The AI prompt/instructions |
| `input_schema` | JSONB | Expected input JSON Schema |
| `output_schema` | JSONB | Expected output JSON Schema |
| `category` | TEXT | Classification |
| `tags` | TEXT[] | Searchable labels |
| `version` | INTEGER | Auto-incremented |
| `source` | TEXT | user / system / external_ai |
| `source_agent` | TEXT | e.g. "claude-3-opus" |

## Key Files
| File | Purpose |
|---|---|
| `app/api/v1/skills/route.ts` | List + create |
| `app/api/v1/skills/[id]/route.ts` | Get + update + delete |
