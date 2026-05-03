import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// GET /api/people/[id]/note — get or create the profile note for a person
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id: personId } = await params;

  // Verify person belongs to user
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('id, name')
    .eq('id', personId)
    .eq('user_id', user.id)
    .single();

  if (personError || !person) {
    console.error('[PersonNote] person lookup failed:', personError?.message);
    return apiError(ErrorCode.NOT_FOUND, 'Person not found');
  }

  // Find existing profile note via stable event_id marker
  const personMarker = `person:${personId}`;
  const { data: existing, error: lookupError } = await supabase
    .from('notes')
    .select('id, title, content, content_text, note_date, event_id, event_title, event_start, note_type, created_at')
    .eq('user_id', user.id)
    .eq('event_id', personMarker)
    .eq('is_deleted', false)
    .maybeSingle();

  if (lookupError) console.error('[PersonNote] lookup error:', lookupError.message);
  if (existing) return NextResponse.json(existing);

  // Create new profile note — use 'manual' type (safe without migration)
  const { data: newNote, error: createError } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: person.name,
      note_type: 'manual',
      event_id: personMarker,
      content: null,
      content_text: '',
    })
    .select('id, title, content, content_text, note_date, event_id, event_title, event_start, note_type, created_at')
    .single();

  if (createError || !newNote) {
    console.error('[PersonNote] create failed:', createError?.message);
    return apiError(ErrorCode.INTERNAL_ERROR, createError?.message || 'Failed to create note');
  }

  return NextResponse.json(newNote);
}
