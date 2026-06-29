import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { claimPublicCheckoutForUser } from '@/lib/billing/public-checkout';
import { verifySignedMarketingToken } from '@/lib/marketing/signed-token';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : '';
    const payload = verifySignedMarketingToken(token, 'public_checkout');
    if (!payload) return apiError(ErrorCode.UNAUTHORIZED, 'Checkout token is invalid or expired', 401);

    const result = await claimPublicCheckoutForUser(getSupabaseAdmin(), {
      tokenSessionId: payload.id,
      userId: user.id,
      userEmail: user.email || '',
    });
    if (!result.ok) {
      const status = result.reason === 'email_mismatch' ? 409 : result.reason === 'not_paid' ? 402 : 404;
      return apiError(ErrorCode.VALIDATION_ERROR, result.reason, status);
    }
    return apiSuccess({ claimed: true, email: result.email });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Unable to claim checkout', 500);
  }
}
