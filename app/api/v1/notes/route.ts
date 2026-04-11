import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/**
 * GET /api/v1/notes
 * List notes for the authenticated user.
 *
 * Query params:
 *   - year: Filter by year
 *   - month: Filter by month (requires year)
 *   - person_id: Filter notes mentioning a specific person
 *   - limit: Max results (default 50)
 *   - offset: Pagination offset (default 0)
 *   - search: Full-text search in content_text
 *
 * Auth: Bearer <api_key> with scope "notes.read"
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['notes.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const url = new URL(req.url);
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const personId = url.searchParams.get('person_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');

    let query = supabase
      .from('notes')
      .select(`
        id, title, content_text, note_date, event_id, event_title, event_start,
        note_type, created_at, updated_at,
        note_mentions(person_id, people(id, name, email))
      `)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (year && month) {
      const start = `${year}-${month.padStart(2, '0')}-01`;
      const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
      query = query.gte('note_date', start).lte('note_date', end);
    } else if (year) {
      query = query.gte('note_date', `${year}-01-01`).lte('note_date', `${year}-12-31`);
    }

    if (search) {
      query = query.ilike('content_text', `%${search}%`);
    }

    if (personId) {
      const { data: mentionedNoteIds } = await supabase
        .from('note_mentions')
        .select('note_id')
        .eq('person_id', personId);
      const ids = (mentionedNoteIds || []).map((m: { note_id: string }) => m.note_id);
      if (ids.length === 0) return apiSuccess({ notes: [], count: 0 });
      query = query.in('id', ids);
    }

    const { data, error, count } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    return apiSuccess({ notes: data || [], count: data?.length || 0, offset, limit });
  } catch (err: any) {
    console.error('GET /api/v1/notes error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * POST /api/v1/notes
 * Create a new note.
 *
 * Body (JSON):
 *   - title: Note title (default "Untitled")
 *   - content_text (required): Plain text content
 *   - content: TipTap JSON content (optional)
 *   - note_date: Date string (YYYY-MM-DD), defaults to today
 *   - note_type: "manual" | "event" | "daily_briefing" (default "manual")
 *   - event_id: Google Calendar event ID (optional)
 *   - event_title: Cached event title (optional)
 *   - event_start: Cached event start (optional)
 *   - mention_ids: Array of person UUIDs to @mention
 *
 * Auth: Bearer <api_key> with scope "notes.write"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['notes.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const body = await req.json();
    const { title, content, content_text, note_date, event_id, event_title, event_start, note_type, mention_ids } = body;

    if (!content_text && !content) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'content_text or content is required');
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: title || 'Untitled',
        content,
        content_text: content_text || '',
        note_date: note_date || new Date().toISOString().split('T')[0],
        event_id,
        event_title,
        event_start,
        note_type: note_type || 'manual',
      })
      .select('id, title, note_date, created_at')
      .single();

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    if (mention_ids?.length) {
      await supabase.from('note_mentions').insert(
        mention_ids.map((pid: string) => ({ note_id: note.id, person_id: pid }))
      );
    }

    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/v1/notes error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
