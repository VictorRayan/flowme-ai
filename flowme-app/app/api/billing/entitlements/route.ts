import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';

function managementSurface(provider: string | null | undefined, hasPro: boolean) {
  if (!hasPro) return 'none';
  if (provider === 'stripe' || provider === 'apple' || provider === 'google') return provider;
  return 'none';
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_subscriptions')
      .select('plan_code,billing_provider,status,current_period_end,grace_period_ends_at,cancel_at_period_end,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    const entitlements = computeEntitlementsFromSubscription(user.id, data);
    return apiSuccess({
      entitlements,
      billing: {
        provider: data?.billing_provider || null,
        state: entitlements.billing_state,
        current_period_end: data?.current_period_end || null,
        cancel_at_period_end: Boolean(data?.cancel_at_period_end),
        management_surface: managementSurface(data?.billing_provider, entitlements.has_pro),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to load entitlements';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
