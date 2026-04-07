import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// PATCH /api/people/[id] — rename a person and update all @mention labels in notes
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth();
  const { id: personId } = await params;
  const { name } = await request.json();

  if (!name?.trim()) return apiError(ErrorCode.VALIDATION_ERROR, 'Name is required');

  // Get old name before update
  const { data: person, error: fetchError } = await supabase
    .from('people')
    .select('id, name')
    .eq('id', personId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !person) return apiError(ErrorCode.NOT_FOUND, 'Person not found');

  const newName = name.trim();
  const oldName = person.name;

  // Update person name
  const { error: updateError } = await supabase
    .from('people')
    .update({ name: newName })
    .eq('id', personId)
    .eq('user_id', user.id);

  if (updateError) return apiError(ErrorCode.INTERNAL_ERROR, updateError.message);

  // Update profile note title if it exists
  await supabase
    .from('notes')
    .update({ title: newName })
    .eq('user_id', user.id)
    .like('event_id', `person:${personId}`);

  // Update @mention labels in all note JSON content
  // Get all notes that mention this person
  const { data: mentionedNotes } = await supabase
    .from('note_mentions')
    .select('note_id')
    .eq('person_id', personId);

  if (mentionedNotes?.length) {
    const noteIds = mentionedNotes.map((m: { note_id: string }) => m.note_id);

    const { data: notes } = await supabase
      .from('notes')
      .select('id, content')
      .in('id', noteIds)
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    for (const note of notes || []) {
      if (!note.content) continue;
      // Walk TipTap JSON and update mention labels for this person
      const updated = updateMentionLabels(note.content, personId, newName);
      if (updated) {
        await supabase.from('notes').update({ content: updated }).eq('id', note.id);
      }
    }
  }

  return NextResponse.json({ id: personId, name: newName, oldName });
}

// DELETE /api/people/[id] — delete person and their profile note
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth();
  const { id: personId } = await params;

  // Verify ownership
  const { data: person } = await supabase
    .from('people')
    .select('id')
    .eq('id', personId)
    .eq('user_id', user.id)
    .single();

  if (!person) return apiError(ErrorCode.NOT_FOUND, 'Person not found');

  // Soft-delete their profile note (event_id marker)
  await supabase
    .from('notes')
    .update({ is_deleted: true })
    .eq('user_id', user.id)
    .eq('event_id', `person:${personId}`);

  // Delete the person (cascades note_mentions)
  const { error } = await supabase
    .from('people')
    .delete()
    .eq('id', personId)
    .eq('user_id', user.id);

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json({ success: true });
}

// Recursively walk TipTap JSON and replace mention label for a given id
function updateMentionLabels(node: Record<string, unknown>, personId: string, newLabel: string): Record<string, unknown> | null {
  let changed = false;

  function walk(n: unknown): unknown {
    if (!n || typeof n !== 'object') return n;
    const obj = n as Record<string, unknown>;

    if (obj.type === 'mention' && obj.attrs && typeof obj.attrs === 'object') {
      const attrs = obj.attrs as Record<string, unknown>;
      if (attrs.id === personId && attrs.label !== newLabel) {
        changed = true;
        return { ...obj, attrs: { ...attrs, label: newLabel } };
      }
    }

    if (Array.isArray(obj.content)) {
      const newContent = obj.content.map(walk);
      return { ...obj, content: newContent };
    }

    return obj;
  }

  const result = walk(node) as Record<string, unknown>;
  return changed ? result : null;
}
