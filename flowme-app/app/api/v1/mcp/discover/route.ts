import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/errors';

/**
 * GET /api/v1/mcp/discover
 *
 * Balys MCP (Model Context Protocol) Discovery Endpoint.
 * Returns the complete API specification for external AI agents
 * to understand what capabilities Flow Me exposes.
 *
 * This endpoint is public (no auth required) so that AIs
 * can discover capabilities before authenticating.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return apiSuccess({
    name: 'Flowme AI',
    version: '1.0.0',
    description: 'Flow Me is a personal productivity platform with calendar, notes, document knowledge base, and AI skill management. Connect your AI assistant to manage your schedule, capture notes, upload documents for AI analysis, and create custom AI processing skills.',
    auth: {
      type: 'bearer',
      header: 'Authorization',
      prefix: 'Bearer',
      description: 'Use an API key generated from Flow Me Settings → API Keys. Keys are prefixed with "fm_".',
      key_management_url: `${baseUrl}/app/settings/api-keys`,
    },
    base_url: `${baseUrl}/api/v1`,
    scopes: {
      'calendar.read': 'Read calendar events (Google Calendar + Flowme events)',
      'calendar.write': 'Create, update, and delete calendar events',
      'notes.read': 'Read and search notes',
      'notes.write': 'Create, update, and delete notes',
      'skills.read': 'Read AI skills and their configurations',
      'skills.write': 'Create, update, and delete AI skills',
      'documents.read': 'Read documents, summaries, and key points',
      'documents.write': 'Upload and delete documents',
      '*': 'Full access to all resources',
    },
    tools: [
      // ===== CALENDAR =====
      {
        name: 'list_calendar_events',
        description: 'List calendar events within a date range. Returns both Google Calendar events and Flowme-native events.',
        method: 'GET',
        path: '/calendar/events',
        scope: 'calendar.read',
        parameters: {
          query: {
            start: { type: 'string', format: 'ISO 8601 date', required: true, description: 'Start of date range' },
            end: { type: 'string', format: 'ISO 8601 date', required: true, description: 'End of date range' },
            include_flowme_events: { type: 'boolean', default: false, description: 'Include Flowme-native events' },
            include_google_events: { type: 'boolean', default: true, description: 'Include Google Calendar events' },
            account_ids: { type: 'string', description: 'Comma-separated linked account UUIDs to filter' },
          },
        },
        response: {
          events: [{
            source: 'google | flowme',
            id: 'string',
            title: 'string',
            description: 'string | null',
            start_at: 'ISO 8601 datetime',
            end_at: 'ISO 8601 datetime | null',
            meet_link: 'string | null',
            participants: [{ email: 'string', name: 'string' }],
            location: 'string | null',
          }],
        },
      },
      {
        name: 'create_calendar_event',
        description: 'Create a new event on Google Calendar. Supports Meet links and participants.',
        method: 'POST',
        path: '/calendar/create',
        scope: 'calendar.write',
        parameters: {
          body: {
            linked_account_id: { type: 'string (UUID)', required: true, description: 'Google linked account ID' },
            title: { type: 'string', required: true, description: 'Event title' },
            start_at: { type: 'string', format: 'ISO 8601 datetime', required: true },
            end_at: { type: 'string', format: 'ISO 8601 datetime', required: true },
            description: { type: 'string', description: 'Event description' },
            create_meet: { type: 'boolean', default: false, description: 'Generate a Google Meet link' },
            participants: { type: 'array', items: { email: 'string' }, description: 'Attendee emails' },
          },
        },
        response: {
          provider_event_id: 'string',
          html_link: 'string',
          meet_link: 'string | null',
        },
      },
      {
        name: 'delete_calendar_event',
        description: 'Delete an event from Google Calendar.',
        method: 'DELETE',
        path: '/calendar/delete',
        scope: 'calendar.write',
        parameters: {
          body: {
            event_id: { type: 'string', required: true, description: 'Google Calendar event ID' },
            linked_account_id: { type: 'string (UUID)', required: true, description: 'Google linked account ID' },
          },
        },
        response: { deleted: true, provider_event_id: 'string' },
      },

      // ===== NOTES =====
      {
        name: 'list_notes',
        description: 'List notes with optional filtering by date, person, or text search. Supports pagination.',
        method: 'GET',
        path: '/notes',
        scope: 'notes.read',
        parameters: {
          query: {
            year: { type: 'string', description: 'Filter by year (e.g. "2026")' },
            month: { type: 'string', description: 'Filter by month (1-12, requires year)' },
            person_id: { type: 'string (UUID)', description: 'Filter by mentioned person' },
            search: { type: 'string', description: 'Full-text search in content' },
            limit: { type: 'integer', default: 50, description: 'Max results (max 100)' },
            offset: { type: 'integer', default: 0, description: 'Pagination offset' },
          },
        },
        response: {
          notes: [{
            id: 'UUID',
            title: 'string',
            content_text: 'string',
            note_date: 'YYYY-MM-DD',
            note_type: 'manual | event | daily_briefing',
            created_at: 'ISO datetime',
          }],
          count: 'integer',
        },
      },
      {
        name: 'get_note',
        description: 'Get a specific note by ID including full content and mentions.',
        method: 'GET',
        path: '/notes/{id}',
        scope: 'notes.read',
        parameters: { path: { id: { type: 'string (UUID)', required: true } } },
        response: { note: { id: 'UUID', title: 'string', content: 'JSON', content_text: 'string' } },
      },
      {
        name: 'create_note',
        description: 'Create a new note. Perfect for capturing meeting summaries, research findings, or AI-generated content.',
        method: 'POST',
        path: '/notes',
        scope: 'notes.write',
        parameters: {
          body: {
            title: { type: 'string', default: 'Untitled' },
            content_text: { type: 'string', required: true, description: 'Plain text content' },
            content: { type: 'JSON', description: 'TipTap rich-text JSON (optional)' },
            note_date: { type: 'string', format: 'YYYY-MM-DD', default: 'today' },
            note_type: { type: 'string', enum: ['manual', 'event', 'daily_briefing'], default: 'manual' },
            event_id: { type: 'string', description: 'Link to a Google Calendar event' },
            mention_ids: { type: 'array of UUID', description: 'Person IDs to @mention' },
          },
        },
        response: { note: { id: 'UUID', title: 'string', note_date: 'string', created_at: 'datetime' } },
      },
      {
        name: 'delete_note',
        description: 'Soft-delete a note by ID.',
        method: 'DELETE',
        path: '/notes/{id}',
        scope: 'notes.write',
        parameters: { path: { id: { type: 'string (UUID)', required: true } } },
        response: { deleted: true },
      },

      // ===== SKILLS =====
      {
        name: 'list_skills',
        description: 'List AI skills available to the user. Skills define reusable AI processing instructions.',
        method: 'GET',
        path: '/skills',
        scope: 'skills.read',
        parameters: {
          query: {
            category: { type: 'string', enum: ['general', 'calendar', 'notes', 'research', 'communication', 'automation', 'custom'] },
            tag: { type: 'string', description: 'Filter by tag' },
            search: { type: 'string', description: 'Search in name/description' },
            source: { type: 'string', enum: ['user', 'system', 'external_ai'] },
            limit: { type: 'integer', default: 50 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          skills: [{
            id: 'UUID',
            name: 'string (slug)',
            display_name: 'string',
            description: 'string',
            instructions: 'string',
            input_schema: 'JSON Schema',
            output_schema: 'JSON Schema',
            category: 'string',
            tags: ['string'],
            version: 'integer',
          }],
        },
      },
      {
        name: 'get_skill',
        description: 'Get a specific skill by ID or name (slug). Returns full instructions and schemas.',
        method: 'GET',
        path: '/skills/{id_or_name}',
        scope: 'skills.read',
        parameters: { path: { id_or_name: { type: 'string', required: true, description: 'UUID or skill name slug' } } },
        response: { skill: {} },
      },
      {
        name: 'create_skill',
        description: 'Create a new AI skill. External AIs use this to teach Flow Me new processing capabilities.',
        method: 'POST',
        path: '/skills',
        scope: 'skills.write',
        parameters: {
          body: {
            name: { type: 'string', required: true, description: 'Unique slug (lowercase, underscores)' },
            display_name: { type: 'string', required: true, description: 'Human-readable name' },
            description: { type: 'string', description: 'What the skill does' },
            instructions: { type: 'string', required: true, description: 'AI processing instructions/prompt' },
            input_schema: { type: 'JSON Schema', description: 'Expected input format' },
            output_schema: { type: 'JSON Schema', description: 'Expected output format' },
            category: { type: 'string', enum: ['general', 'calendar', 'notes', 'research', 'communication', 'automation', 'custom'] },
            tags: { type: 'array of string', description: 'Searchable tags' },
            source_agent: { type: 'string', description: 'Agent name (e.g. "claude-3-opus")' },
          },
        },
        response: { skill: { id: 'UUID', name: 'string', version: 1 } },
      },
      {
        name: 'update_skill',
        description: 'Update an existing skill. Automatically increments the version number.',
        method: 'PUT',
        path: '/skills/{id_or_name}',
        scope: 'skills.write',
        parameters: {
          path: { id_or_name: { type: 'string', required: true } },
          body: {
            display_name: { type: 'string' },
            description: { type: 'string' },
            instructions: { type: 'string' },
            input_schema: { type: 'JSON Schema' },
            output_schema: { type: 'JSON Schema' },
            category: { type: 'string' },
            tags: { type: 'array of string' },
            is_active: { type: 'boolean' },
          },
        },
        response: { skill: { id: 'UUID', version: 'integer' } },
      },
      {
        name: 'delete_skill',
        description: 'Soft-delete a skill by ID or name.',
        method: 'DELETE',
        path: '/skills/{id_or_name}',
        scope: 'skills.write',
        parameters: { path: { id_or_name: { type: 'string', required: true } } },
        response: { deleted: true },
      },

      // ===== DOCUMENTS (Knowledge Base) =====
      {
        name: 'list_documents',
        description: 'List uploaded documents with AI-generated summaries and key points. Documents form a neural knowledge graph.',
        method: 'GET',
        path: '/documents',
        scope: 'documents.read',
        parameters: {
          query: {
            search: { type: 'string', description: 'Search in filename, summary, content' },
            tag: { type: 'string', description: 'Filter by tag' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'skipped'], description: 'Processing status' },
            limit: { type: 'integer', default: 50 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          documents: [{
            id: 'UUID',
            filename: 'string',
            file_hash: 'string (SHA-256)',
            summary: 'One-line AI summary',
            key_points: 'Markdown structured key points',
            tags: ['string'],
            processing_status: 'string',
          }],
        },
      },
      {
        name: 'get_document',
        description: 'Get full document details including AI summary, key points, and a presigned download URL.',
        method: 'GET',
        path: '/documents/{id}',
        scope: 'documents.read',
        parameters: { path: { id: { type: 'string', required: true, description: 'UUID or file hash' } } },
        response: { document: { id: 'UUID', summary: 'string', key_points: 'markdown', download_url: 'presigned URL (1h)' } },
      },
      {
        name: 'upload_document',
        description: 'Upload a document. Stored in R2, auto-processed by AI for summary + key points. Supports multipart/form-data or JSON with base64.',
        method: 'POST',
        path: '/documents',
        scope: 'documents.write',
        parameters: {
          body: {
            file: { type: 'File (multipart)', description: 'The file to upload' },
            filename: { type: 'string', description: 'Required for JSON body (with content_base64)' },
            content_base64: { type: 'string', description: 'Base64-encoded file content (alternative to multipart)' },
            mime_type: { type: 'string', description: 'MIME type (for JSON body)' },
            tags: { type: 'array or comma-separated string', description: 'Tags for the document' },
          },
        },
        response: { document: { id: 'UUID', filename: 'string', summary: 'string', key_points: 'markdown' } },
      },
      {
        name: 'delete_document',
        description: 'Soft-delete a document and remove from storage.',
        method: 'DELETE',
        path: '/documents/{id}',
        scope: 'documents.write',
        parameters: { path: { id: { type: 'string (UUID)', required: true } } },
        response: { deleted: true },
      },
    ],

    examples: {
      'List today\'s events': {
        method: 'GET',
        url: '/api/v1/calendar/events?start=2026-04-11T00:00:00Z&end=2026-04-12T00:00:00Z',
        headers: { 'Authorization': 'Bearer fm_your_key_here' },
      },
      'Create a meeting': {
        method: 'POST',
        url: '/api/v1/calendar/create',
        headers: { 'Authorization': 'Bearer fm_your_key_here', 'Content-Type': 'application/json' },
        body: {
          linked_account_id: '<account-uuid>',
          title: 'Team Standup',
          start_at: '2026-04-12T09:00:00-03:00',
          end_at: '2026-04-12T09:30:00-03:00',
          create_meet: true,
        },
      },
      'Create a note': {
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'Authorization': 'Bearer fm_your_key_here', 'Content-Type': 'application/json' },
        body: {
          title: 'Meeting Summary',
          content_text: 'Discussed Q2 roadmap priorities...',
          note_date: '2026-04-11',
        },
      },
      'Create a skill': {
        method: 'POST',
        url: '/api/v1/skills',
        headers: { 'Authorization': 'Bearer fm_your_key_here', 'Content-Type': 'application/json' },
        body: {
          name: 'summarize_meeting',
          display_name: 'Summarize Meeting Notes',
          description: 'Takes raw meeting transcript and produces structured summary with action items.',
          instructions: 'You are a meeting summarizer. Given a raw transcript, produce: 1) Key decisions, 2) Action items with owners, 3) Next steps.',
          category: 'notes',
          tags: ['meetings', 'summary'],
          source_agent: 'claude-3-opus',
        },
      },
      'Upload a document (JSON)': {
        method: 'POST',
        url: '/api/v1/documents',
        headers: { 'Authorization': 'Bearer fm_your_key_here', 'Content-Type': 'application/json' },
        body: {
          filename: 'meeting_notes.md',
          content_base64: 'IyBNZWV0aW5nIE5vdGVzCi4uLg==',
          mime_type: 'text/markdown',
          tags: ['meetings', 'q2'],
        },
      },
      'Search documents': {
        method: 'GET',
        url: '/api/v1/documents?search=roadmap&tag=q2',
        headers: { 'Authorization': 'Bearer fm_your_key_here' },
      },
    },
  });
}
