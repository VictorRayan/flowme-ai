import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { saveWeeklyBriefingAndRegenerate } from '@/lib/reviews/weekly-review';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const briefing = typeof body.briefing === 'string' ? body.briefing.trim() : '';
    if (briefing.length < 5 || briefing.length > 4000) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'briefing must contain between 5 and 4000 characters');
    }
    const review = await saveWeeklyBriefingAndRegenerate(supabase, user.id, briefing, {
      timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
    });
    return apiSuccess({ review });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save weekly briefing', 500);
  }
}
