import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { getFinanceMonthlySummary } from '@/lib/finance/finance';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'month must be YYYY-MM', 400);
  }

  try {
    const summary = await getFinanceMonthlySummary(supabase, user.id, month);
    return apiSuccess({ summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to build finance summary';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
