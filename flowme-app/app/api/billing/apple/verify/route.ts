import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { syncVerifiedMobileSubscription, verifyAppleSubscription } from '@/lib/billing/mobile-subscriptions';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const signedTransaction = typeof body.signed_transaction === 'string' ? body.signed_transaction.trim() : '';
    if (!signedTransaction) return apiError(ErrorCode.VALIDATION_ERROR, 'signed_transaction is required', 400);
    const verified = verifyAppleSubscription(signedTransaction, user.id);
    const result = await syncVerifiedMobileSubscription(getSupabaseAdmin(), user.id, verified);
    return apiSuccess({ entitlements: result.entitlements, billing_provider: 'apple' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.VALIDATION_ERROR, error instanceof Error ? error.message : 'Apple purchase verification failed', 400);
  }
}
