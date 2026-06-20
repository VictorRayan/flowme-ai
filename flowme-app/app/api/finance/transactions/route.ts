import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';
import { createFinancialTransaction, getFinancialProfile, listFinancialTransactions } from '@/lib/finance/finance';
import { isFinanceCurrency, normalizeFinanceCurrency } from '@/lib/finance/currency';
import { FINANCE_TRANSACTION_STATUSES, FINANCE_TRANSACTION_TYPES, type FinanceTransactionSource, type FinanceTransactionStatus, type FinanceTransactionType } from '@/lib/finance/types';

const VALID_SOURCES: FinanceTransactionSource[] = ['web', 'balys', 'whatsapp', 'api', 'import'];

function isType(value: unknown): value is FinanceTransactionType {
  return typeof value === 'string' && FINANCE_TRANSACTION_TYPES.includes(value as FinanceTransactionType);
}

function isStatus(value: unknown): value is FinanceTransactionStatus {
  return typeof value === 'string' && FINANCE_TRANSACTION_STATUSES.includes(value as FinanceTransactionStatus);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    await requireFeature(getSupabaseAdmin(), user.id, 'finance');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    if (type && !isType(type)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction type', 400);
    if (status && !isStatus(status)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction status', 400);
    const requestedType = isType(type) ? type : undefined;
    const requestedStatus = isStatus(status) ? status : undefined;

    const transactions = await listFinancialTransactions(supabase, user.id, {
      month: searchParams.get('month') || undefined,
      type: requestedType,
      status: requestedStatus,
      category: searchParams.get('category') || undefined,
      limit: Number(searchParams.get('limit') || 100),
    });
    return apiSuccess({ transactions });
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
    const message = error instanceof Error ? error.message : 'Failed to list financial transactions';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    await requireFeature(getSupabaseAdmin(), user.id, 'finance');
    const body = await request.json().catch(() => ({}));

    if (!isType(body.type)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction type', 400);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return apiError(ErrorCode.VALIDATION_ERROR, 'amount must be greater than zero', 400);
    if (!validDate(body.occurred_on)) return apiError(ErrorCode.VALIDATION_ERROR, 'occurred_on must be YYYY-MM-DD', 400);
    if (body.currency !== undefined && !isFinanceCurrency(body.currency)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid currency', 400);
    }
    if (body.status !== undefined && !isStatus(body.status)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction status', 400);
    }
    if (body.source !== undefined && !VALID_SOURCES.includes(body.source)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction source', 400);
    }

    const profile = await getFinancialProfile(supabase, user.id);
    const transaction = await createFinancialTransaction(supabase, user.id, {
      type: body.type,
      amount,
      currency: normalizeFinanceCurrency(body.currency, profile.default_currency),
      occurred_on: body.occurred_on,
      category_name: body.category_name,
      merchant: body.merchant,
      description: body.description,
      payment_method: body.payment_method,
      source: body.source || 'web',
      raw_text: body.raw_text,
      confidence: body.confidence === undefined ? null : Number(body.confidence),
      status: body.status || 'confirmed',
    });
    return apiSuccess({ transaction });
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
    const message = error instanceof Error ? error.message : 'Failed to create financial transaction';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
