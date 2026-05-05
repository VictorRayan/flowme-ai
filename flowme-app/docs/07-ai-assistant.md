# AI Assistant (Balys)

## Overview
Built-in AI assistant powered by **OpenAI** and **Google Gemini**. Provides chat, calendar skills (natural language event management), and audio transcription.

## Features
- **Chat**: Conversational AI with context awareness
- **Calendar skill**: Parse natural language into calendar actions (e.g. "Schedule a meeting with John tomorrow at 2pm")
- **Transcription**: Audio-to-text via Whisper
- **Multi-model**: Supports OpenAI (GPT-4o) and Gemini (Flash, Pro)
- **Usage tracking**: Token counts, cost estimation per request
- **Billing awareness**: Per-model pricing (USD/1M tokens)

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/ai/chat` | POST | AI chat completion |
| `/api/ai/models` | GET | List available models |
| `/api/ai/spend` | GET | Usage & cost analytics |

## Calendar Skill
**File:** `lib/ai/calendar-skill.ts`

Parses natural language into structured calendar operations. The AI extracts:
- Event title, date, time, duration
- Participants
- Location
- Whether to create a Meet link

## Usage Tracking
**File:** `lib/ai/billing.ts`

| Function | Purpose |
|---|---|
| `computeCostUsd()` | Calculate cost from token counts |
| `logAiUsage()` | Insert into `ai_usage_logs` |
| `estimateTokensFromText()` | Approximate token count (~4 chars/token) |

### Model Pricing (USD per 1M tokens)
| Model | Input | Output |
|---|---|---|
| gpt-4o | $5.00 | $15.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-2.5-pro | $1.25 | $5.00 |

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `ai_usage_logs` | `008_ai_usage_logs.sql` | Token + cost tracking per request |

## Environment Variables
```env
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

## Key Files
| File | Purpose |
|---|---|
| `lib/ai/billing.ts` | Cost calculation + usage logging |
| `lib/ai/calendar-skill.ts` | NL → calendar action parser |
| `app/api/ai/chat/` | Chat endpoint |
| `app/api/ai/models/` | Available models |
| `app/api/ai/spend/` | Usage analytics |
| `app/app/ai/` | AI chat UI |
| `components/ai/` | Chat components |
