import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { fetchGoogleSubscription, syncVerifiedMobileSubscription } from '@/lib/billing/mobile-subscriptions';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const purchaseToken = typeof body.purchase_token === 'string' ? body.purchase_token.trim() : '';
    if (!purchaseToken) return apiError(ErrorCode.VALIDATION_ERROR, 'purchase_token is required', 400);
    const verified = await fetchGoogleSubscription(purchaseToken, user.id);
    const result = await syncVerifiedMobileSubscription(getSupabaseAdmin(), user.id, verified);
    return apiSuccess({ entitlements: result.entitlements, billing_provider: 'google' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.VALIDATION_ERROR, error instanceof Error ? error.message : 'Google Play purchase verification failed', 400);
  }
}
