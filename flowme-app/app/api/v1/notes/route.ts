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
        note_type, created_at, updated_at
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
      const { data: ownedPerson } = await supabase.from('people')
        .select('id').eq('id', personId).eq('user_id', userId).maybeSingle();
      if (!ownedPerson) return apiSuccess({ notes: [], count: 0 });
      const { data: mentionedNoteIds } = await supabase
        .from('note_mentions')
        .select('note_id')
        .eq('person_id', personId);
      const ids = (mentionedNoteIds || []).map((m: { note_id: string }) => m.note_id);
      if (ids.length === 0) return apiSuccess({ notes: [], count: 0 });
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    const notes = data || [];
    const noteIds = notes.map((note: { id: string }) => note.id);
    let mentionsByNote = new Map<string, Array<{ person_id: string; people: { id: string; name: string; email: string | null } }>>();
    if (noteIds.length > 0) {
      const { data: mentions, error: mentionsError } = await supabase.from('note_mentions')
        .select('note_id,person_id').in('note_id', noteIds);
      if (mentionsError) return apiError(ErrorCode.INTERNAL_ERROR, mentionsError.message, 500);
      const personIds = [...new Set((mentions || []).map((mention: { person_id: string }) => mention.person_id))];
      if (personIds.length > 0) {
        const { data: people, error: peopleError } = await supabase.from('people')
          .select('id,name,email').eq('user_id', userId).in('id', personIds);
        if (peopleError) return apiError(ErrorCode.INTERNAL_ERROR, peopleError.message, 500);
        const ownedPeople = new Map<string, { id: string; name: string; email: string | null }>(
          (people || []).map((person: { id: string; name: string; email: string | null }) => [person.id, person]),
        );
        mentionsByNote = new Map();
        for (const mention of mentions || []) {
          const person = ownedPeople.get(mention.person_id);
          if (!person) continue;
          const list = mentionsByNote.get(mention.note_id) || [];
          list.push({ person_id: mention.person_id, people: person });
          mentionsByNote.set(mention.note_id, list);
        }
      }
    }

    return apiSuccess({ notes: notes.map((note: { id: string }) => ({ ...note, note_mentions: mentionsByNote.get(note.id) || [] })), count: notes.length, offset, limit });
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

    if (mention_ids !== undefined) {
      if (!Array.isArray(mention_ids) || mention_ids.length > 50 || mention_ids.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'mention_ids must be an array of person IDs');
      }
      if (mention_ids.length > 0) {
        const uniqueIds = [...new Set(mention_ids)];
        const { data: ownedPeople, error: peopleError } = await supabase.from('people')
          .select('id').eq('user_id', userId).in('id', uniqueIds);
        if (peopleError) return apiError(ErrorCode.INTERNAL_ERROR, peopleError.message, 500);
        if ((ownedPeople || []).length !== uniqueIds.length) {
          return apiError(ErrorCode.VALIDATION_ERROR, 'One or more mentioned people are unavailable', 400);
        }
      }
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
      const { error: mentionError } = await supabase.from('note_mentions').insert(
        mention_ids.map((pid: string) => ({ note_id: note.id, person_id: pid }))
      );
      if (mentionError) return apiError(ErrorCode.INTERNAL_ERROR, mentionError.message, 500);
    }

    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/v1/notes error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
