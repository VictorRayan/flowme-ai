import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { normalizeMobilePushTokenInput } from '@/lib/mobile-push/tokens';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const normalized = normalizeMobilePushTokenInput(body, user.id);
    if (!normalized.ok) return apiError(ErrorCode.VALIDATION_ERROR, normalized.error, 400);

    const { error } = await supabase
      .from('mobile_push_tokens')
      .upsert(normalized.row, { onConflict: 'user_id,provider,device_token' });
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    return apiSuccess({ registered: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to register mobile push token';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const token = searchParams.get('device_token') || searchParams.get('token');
    const deviceId = searchParams.get('device_id');

    if (!provider || (!token && !deviceId)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'provider and device_token or device_id required', 400);
    }

    let query = supabase
      .from('mobile_push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', provider);

    query = token ? query.eq('device_token', token) : query.eq('device_id', deviceId);

    const { error } = await query;
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to delete mobile push token';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
