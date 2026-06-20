import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { getAiCreditState, isValidTimezone } from '@/lib/billing/credits';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const timezone = new URL(request.url).searchParams.get('timezone') || 'UTC';
    if (!isValidTimezone(timezone)) return apiError(ErrorCode.VALIDATION_ERROR, 'timezone is invalid');
    const credits = await getAiCreditState(supabase, user.id, timezone);
    return apiSuccess({ credits });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = error instanceof Error ? error.message : 'Failed to load AI credits';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
