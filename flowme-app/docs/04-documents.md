# Documents (Knowledge Base)

## Overview
Obsidian-like document knowledge system. Files are stored on **Cloudflare R2**, metadata and AI-generated summaries are stored in **Supabase**. Documents can be referenced inside notes via `/file` shortcut, creating a neural knowledge graph.

## Features
- **File upload**: Any file type, stored in R2
- **AI analysis**: Gemini auto-generates one-line summary + structured key points in markdown
- **Deduplication**: SHA-256 hash prevents duplicate uploads
- **Tags**: Auto-suggested by AI + manual tags
- **Search**: Full-text search in filename, summary, and extracted content
- **Note linking**: Reference documents inside notes with `[filename] → [summary]`
- **Presigned URLs**: Time-limited (1h) download links for secure access

## Architecture

```
Upload → R2 (raw file) + Supabase (metadata)
                                ↓
                          Gemini AI → summary + key_points + tags
                                ↓
                          document record updated

Notes → /file shortcut → document_links → renders as [file] → [summary]
```

## Storage Structure (R2)
```
flow-me-ai/                          ← bucket
└── users/
    └── {user_uuid}/                  ← user-level isolation (by UUID, not email)
        └── docs/
            └── {sha256_hash}/
                └── {sanitized_filename}
```

## Internal API (Session Auth)

| Endpoint | Method | Description |
|---|---|---|
| `/api/documents/upload` | POST | Upload file (multipart/form-data) |
| `/api/documents` | GET | List documents (search, tag, status) |
| `/api/documents/search?q=` | GET | Quick search (for TipTap `/file`) |
| `/api/documents/[id]` | GET | Detail + presigned download URL |
| `/api/documents/[id]` | PATCH | Update tags, summary, key_points |
| `/api/documents/[id]` | DELETE | Soft-delete + R2 cleanup |

## External API (API Key Auth)

| Endpoint | Method | Scope | Description |
|---|---|---|---|
| `/api/v1/documents` | GET | `documents.read` | List/search documents |
| `/api/v1/documents` | POST | `documents.write` | Upload (multipart or base64 JSON) |
| `/api/v1/documents/[id]` | GET | `documents.read` | Detail + download URL |
| `/api/v1/documents/[id]` | DELETE | `documents.write` | Delete |

### Base64 Upload (for AIs)
```json
POST /api/v1/documents
{
  "filename": "meeting_notes.md",
  "content_base64": "IyBNZWV0aW5nIE5vdGVz...",
  "mime_type": "text/markdown",
  "tags": ["meetings"]
}
```

## AI Processing
**File:** `lib/ai/document-processor.ts`

| Output | Description |
|---|---|
| `summary` | One-line description (≤150 chars) |
| `key_points` | Structured markdown with headers + bullets |
| `tags` | 3-7 auto-suggested labels |
| `content_text` | Extracted text (up to 50k chars for search) |

**Supported formats:** `.txt`, `.md`, `.csv`, `.html`, `.json`, `.xml`, `.yaml`, `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`
**Coming soon:** PDF (needs `pdf-parse`), DOCX (needs `mammoth`)

## Database Tables
| Table | Migration | Purpose |
|---|---|---|
| `documents` | `011_documents.sql` | File metadata + AI knowledge |
| `document_links` | `011_documents.sql` | Note ↔ Document references |

## Key Files
| File | Purpose |
|---|---|
| `lib/r2/storage.ts` | R2 S3 client (upload, download, presign, delete) |
| `lib/ai/document-processor.ts` | Gemini-powered analysis |
| `app/api/documents/*/route.ts` | Internal API routes |
| `app/api/v1/documents/*/route.ts` | External API routes |

## Environment Variables
```env
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=flow-me-ai
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```
