import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';
import { getFinanceMonthlySummary } from '@/lib/finance/finance';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    await requireFeature(getSupabaseAdmin(), user.id, 'finance');
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || currentMonth();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'month must be YYYY-MM', 400);
    }
    const summary = await getFinanceMonthlySummary(supabase, user.id, month);
    return apiSuccess({ summary });
  } catch (error: unknown) {
    if (error instanceof FeatureLockedError) {
      return apiError(ErrorCode.FEATURE_LOCKED, 'Finance requires Flow Me Pro', 402, {
        required_plan: error.required_plan,
        feature_key: error.feature,
        checkout_available: true,
      });
    }
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = error instanceof Error ? error.message : 'Failed to build finance summary';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
