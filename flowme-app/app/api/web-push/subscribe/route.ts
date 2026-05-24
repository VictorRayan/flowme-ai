import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const { endpoint, keys } = body || {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'endpoint required');
    }
    if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'keys with p256dh and auth required');
    }

    const userAgent = req.headers.get('user-agent') || null;
    const { error } = await supabase
      .from('web_push_subscriptions')
      .upsert({ user_id: user.id, endpoint, keys, user_agent: userAgent }, { onConflict: 'user_id,endpoint' });
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ subscribed: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/web-push/subscribe error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    if (!endpoint) return apiError(ErrorCode.VALIDATION_ERROR, 'endpoint required');
    const { error } = await supabase.from('web_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ deleted: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed', 500);
  }
}
