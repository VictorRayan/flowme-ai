import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { token } = await params;
    const { data, error } = await supabase
      .from('notification_targets')
      .select('target_kind, target_payload, expires_at')
      .eq('token', token)
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Notification target not found', 404);
    return apiSuccess({ target: data });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to resolve notification target', 500);
  }
}
