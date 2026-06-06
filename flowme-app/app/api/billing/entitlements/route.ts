import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('plan_code,status,current_period_end,grace_period_ends_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    const entitlements = computeEntitlementsFromSubscription(user.id, data);
    return apiSuccess({ entitlements });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to load entitlements';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
