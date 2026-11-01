import { NextRequest } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { deleteFromR2, getPresignedDownloadUrl } from '@/lib/r2/storage';

/**
 * GET /api/v1/documents/[id]
 * Get full document details including key points, summary, and download URL.
 *
 * Auth: Bearer <api_key> with scope "documents.read"
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['documents.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    // Support lookup by UUID or file_hash
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('file_hash', id);
    }

    const { data, error } = await query.single();
    if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Document not found', 404);

    // Generate presigned download URL
    let download_url = null;
    try {
      download_url = await getPresignedDownloadUrl(data.r2_key, 3600);
    } catch { /* R2 may not be configured */ }

    return apiSuccess({
      document: {
        ...data,
        download_url,
      },
    });
  } catch (err: any) {
    console.error('GET /api/v1/documents/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * DELETE /api/v1/documents/[id]
 * Soft-delete a document + remove from R2.
 *
 * Auth: Bearer <api_key> with scope "documents.write"
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['documents.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    const { data: doc } = await supabase
      .from('documents')
      .select('id, r2_key')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (!doc) return apiError(ErrorCode.NOT_FOUND, 'Document not found', 404);

    const { error: updateError } = await supabase.from('documents').update({ is_deleted: true })
      .eq('id', doc.id).eq('user_id', userId);
    if (updateError) return apiError(ErrorCode.INTERNAL_ERROR, 'Unable to delete document', 500);

    // Delete from R2
    try { await deleteFromR2(doc.r2_key); } catch { /* best effort */ }

    return apiSuccess({ deleted: true, id: doc.id });
  } catch (err: any) {
    console.error('DELETE /api/v1/documents/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
