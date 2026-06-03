import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { getLatestMonthlyReview } from '@/lib/reviews/monthly-review';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const review = await getLatestMonthlyReview(supabase, user.id);
    return apiSuccess({ review });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load monthly review', 500);
  }
}
