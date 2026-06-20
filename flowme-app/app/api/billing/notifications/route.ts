import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(req);
    const { data, error } = await supabase.from('billing_notifications')
      .select('id,kind,provider,status,created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'sent', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ notification: data || null });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to load billing notifications', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return apiError(ErrorCode.VALIDATION_ERROR, 'id is required', 400);
    const { error } = await supabase.from('billing_notifications')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ dismissed: true });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to dismiss billing notification', 500);
  }
}
