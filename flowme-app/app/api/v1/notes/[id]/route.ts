import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/**
 * GET /api/v1/notes/[id]
 * Get a specific note by ID.
 *
 * Auth: Bearer <api_key> with scope "notes.read"
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['notes.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    const { data, error } = await supabase
      .from('notes')
      .select(`*, note_mentions(person_id, people(id, name, email))`)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Note not found', 404);
    return apiSuccess({ note: data });
  } catch (err: any) {
    console.error('GET /api/v1/notes/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * DELETE /api/v1/notes/[id]
 * Soft-delete a note by ID.
 *
 * Auth: Bearer <api_key> with scope "notes.write"
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['notes.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    const { error } = await supabase
      .from('notes')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    return apiSuccess({ deleted: true, id });
  } catch (err: any) {
    console.error('DELETE /api/v1/notes/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
