import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// GET /api/notes/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;

  const { data, error } = await supabase
    .from('notes')
    .select(`*, note_mentions(person_id, people(id, name, email))`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Note not found');
  return NextResponse.json(data);
}

// PATCH /api/notes/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;
  const body = await request.json();
  const { title, content, content_text, note_date, event_id, event_title, event_start, note_type, mention_ids } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (content_text !== undefined) updates.content_text = content_text;
  if (note_date !== undefined) updates.note_date = note_date;
  if (event_id !== undefined) updates.event_id = event_id;
  if (event_title !== undefined) updates.event_title = event_title;
  if (event_start !== undefined) updates.event_start = event_start;
  if (note_type !== undefined) updates.note_type = note_type;

  // Invalidate cached embedding if content changed
  if (content !== undefined || content_text !== undefined || title !== undefined) {
    updates.embedding = null;
    updates.embedding_updated_at = null;
  }

  const { error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);

  if (mention_ids !== undefined) {
    await supabase.from('note_mentions').delete().eq('note_id', id);
    if (mention_ids.length > 0) {
      await supabase.from('note_mentions').insert(
        mention_ids.map((pid: string) => ({ note_id: id, person_id: pid }))
      );
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/notes/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;

  const { error } = await supabase
    .from('notes')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json({ success: true });
}
