import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start and end query parameters are required');
    }

    void supabase;
    void user;
    void start;
    void end;

    return apiSuccess({ events: [] });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/events error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch events', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local event creation is no longer supported. Create a Google Calendar event instead.',
      410,
    );
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/events error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create event', 500);
  }
}
