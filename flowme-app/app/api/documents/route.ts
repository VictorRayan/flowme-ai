import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { ilikeAny } from '@/lib/api/safe-filters';

/**
 * GET /api/documents
 * List documents for the authenticated user.
 *
 * Query params:
 *   - search: Search in filename, summary, content_text
 *   - tag: Filter by tag
 *   - status: Filter by processing_status
 *   - limit: Max results (default 50)
 *   - offset: Pagination offset
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;

    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const tag = url.searchParams.get('tag');
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('documents')
      .select('id, filename, file_hash, mime_type, file_size, summary, tags, processing_status, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(ilikeAny(['filename', 'summary', 'content_text'], search));
    }
    if (tag) query = query.contains('tags', [tag]);
    if (status) query = query.eq('processing_status', status);

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    return apiSuccess({ documents: data || [], count: data?.length || 0, offset, limit });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/documents error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
