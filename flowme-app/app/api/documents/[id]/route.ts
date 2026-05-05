import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { deleteFromR2, getPresignedDownloadUrl } from '@/lib/r2/storage';

/**
 * GET /api/documents/[id]
 * Get document details including full key_points and summary.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;
    const { id } = await params;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Document not found', 404);

    // Generate a presigned download URL (1 hour)
    let download_url = null;
    try {
      download_url = await getPresignedDownloadUrl(data.r2_key, 3600);
    } catch {
      // R2 might not be configured yet
    }

    return apiSuccess({
      document: {
        ...data,
        download_url,
      },
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/documents/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * PATCH /api/documents/[id]
 * Update document metadata (tags, summary, etc.)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.key_points !== undefined) updates.key_points = body.key_points;

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No valid fields to update');
    }

    const { error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    return apiSuccess({ updated: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/documents/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * DELETE /api/documents/[id]
 * Soft-delete a document + remove from R2.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;
    const { id } = await params;

    // Get the R2 key before soft-deleting
    const { data: doc } = await supabase
      .from('documents')
      .select('r2_key')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!doc) return apiError(ErrorCode.NOT_FOUND, 'Document not found', 404);

    // Soft-delete in DB
    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    // Delete from R2 (fire-and-forget)
    try {
      await deleteFromR2(doc.r2_key);
    } catch (r2Err: any) {
      console.error(`Failed to delete R2 object ${doc.r2_key}:`, r2Err.message);
    }

    return apiSuccess({ deleted: true, id });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/documents/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
