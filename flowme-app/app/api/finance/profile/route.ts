import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';
import { getFinancialProfile, upsertFinancialProfile } from '@/lib/finance/finance';
import { isFinanceCurrency } from '@/lib/finance/currency';

function optionalMoney(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    await requireFeature(getSupabaseAdmin(), user.id, 'finance');
    const profile = await getFinancialProfile(supabase, user.id);
    return apiSuccess({ profile });
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
    const message = error instanceof Error ? error.message : 'Failed to load financial profile';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    await requireFeature(getSupabaseAdmin(), user.id, 'finance');
    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (body.default_currency !== undefined) {
      if (!isFinanceCurrency(body.default_currency)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid default_currency', 400);
      }
      patch.default_currency = String(body.default_currency).toUpperCase();
    }

    for (const key of ['monthly_income_target', 'monthly_investment_target', 'emergency_reserve_target']) {
      const parsed = optionalMoney(body[key]);
      if (Number.isNaN(parsed)) return apiError(ErrorCode.VALIDATION_ERROR, `${key} must be a positive number`, 400);
      if (parsed !== undefined) patch[key] = parsed;
    }

    if (body.main_financial_objective !== undefined) {
      patch.main_financial_objective = body.main_financial_objective ? String(body.main_financial_objective).trim() : null;
    }
    if (body.risk_profile !== undefined) {
      patch.risk_profile = body.risk_profile ? String(body.risk_profile).trim() : null;
    }
    if (Object.keys(patch).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No valid fields to update', 400);
    }

    const profile = await upsertFinancialProfile(supabase, user.id, patch);
    return apiSuccess({ profile });
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
    const message = error instanceof Error ? error.message : 'Failed to save financial profile';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
