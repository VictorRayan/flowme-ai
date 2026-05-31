import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { listCalendarReschedules } from '@/lib/calendar/event-reschedule-history';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || '100');
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'limit must be between 1 and 250');
    }
    const reschedules = await listCalendarReschedules(supabase, user.id, {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      limit,
    });
    return apiSuccess({ reschedules });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/calendar/reschedule-history error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load calendar reschedule history', 500);
  }
}
