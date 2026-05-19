import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const date = searchParams.get('date');           // YYYY-MM-DD — filter by scheduled_date
    const category = searchParams.get('category');   // non_negotiable | negotiable | routine
    const status = searchParams.get('status');       // pending | completed | skipped
    const goalId = searchParams.get('goal_id');
    const planId = searchParams.get('plan_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    void date;
    void category;
    void status;
    void goalId;
    void planId;
    void limit;

    return apiSuccess({ tasks: [] });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/tasks error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch tasks', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local tasks are no longer supported. Create a Google Calendar event instead.',
      410,
    );
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/tasks error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create task', 500);
  }
}
