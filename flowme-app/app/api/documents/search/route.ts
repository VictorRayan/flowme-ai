import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/**
 * GET /api/documents/search
 * Quick search for documents — used by TipTap /file command.
 *
 * Query:
 *   - q: Search term (matches filename, summary)
 *   - limit: Max results (default 10)
 *
 * Returns minimal data for quick rendering in the mention dropdown.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;

    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);

    if (q.length === 0) {
      // Return recent documents
      const { data } = await supabase
        .from('documents')
        .select('id, filename, file_hash, mime_type, summary')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(limit);

      return apiSuccess({ documents: data || [] });
    }

    const { data } = await supabase
      .from('documents')
      .select('id, filename, file_hash, mime_type, summary')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .or(`filename.ilike.%${q}%,summary.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    return apiSuccess({ documents: data || [] });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
