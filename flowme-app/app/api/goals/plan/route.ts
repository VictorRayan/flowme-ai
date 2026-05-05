import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();

    try {
      const result = await persistGoalOperatingPlan(supabase, user.id, {
        annual_smart_goal: body.annual_smart_goal,
        monthly_milestone: body.monthly_milestone,
        weekly_routine: body.weekly_routine,
        start_date: body.start_date,
        target_date: body.target_date,
        preferred_time: body.preferred_time,
        default_task_duration_minutes: body.default_task_duration_minutes,
        execution_window_days: body.execution_window_days,
      });
      return apiSuccess(result);
    } catch (err) {
      if (err instanceof Error && isPlanValidationMessage(err.message)) {
        return apiError(ErrorCode.VALIDATION_ERROR, err.message);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/goals/plan error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create goal operating plan', 500);
  }
}

function isPlanValidationMessage(message: string): boolean {
  return [
    'annual_smart_goal is required',
    'monthly_milestone is required',
    'weekly_routine is required',
  ].includes(message);
}
