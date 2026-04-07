import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// GET /api/notes — list notes, optionally filtered by date range or person
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const personId = searchParams.get('person_id');

  let query = supabase
    .from('notes')
    .select(`
      id, title, content_text, note_date, event_id, event_title, event_start, note_type, created_at, updated_at,
      note_mentions(person_id, people(id, name, email))
    `)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (year && month) {
    const start = `${year}-${month.padStart(2, '0')}-01`;
    const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
    query = query.gte('note_date', start).lte('note_date', end);
  } else if (year) {
    query = query.gte('note_date', `${year}-01-01`).lte('note_date', `${year}-12-31`);
  }

  if (personId) {
    const { data: mentionedNoteIds } = await supabase
      .from('note_mentions')
      .select('note_id')
      .eq('person_id', personId);
    const ids = (mentionedNoteIds || []).map((m: { note_id: string }) => m.note_id);
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in('id', ids);
  }

  const { data, error } = await query;
  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json(data || []);
}

// POST /api/notes — create a new note
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const body = await request.json();
  const { title, content, content_text, note_date, event_id, event_title, event_start, note_type, mention_ids } = body;

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: title || 'Untitled',
      content,
      content_text,
      note_date,
      event_id,
      event_title,
      event_start,
      note_type: note_type || 'manual',
    })
    .select('id')
    .single();

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);

  if (mention_ids?.length) {
    await supabase.from('note_mentions').insert(
      mention_ids.map((pid: string) => ({ note_id: note.id, person_id: pid }))
    );
  }

  return NextResponse.json({ id: note.id }, { status: 201 });
}
