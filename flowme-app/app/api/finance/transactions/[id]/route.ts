import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { deleteFinancialTransaction, updateFinancialTransaction } from '@/lib/finance/finance';
import { isFinanceCurrency } from '@/lib/finance/currency';
import { FINANCE_TRANSACTION_STATUSES, FINANCE_TRANSACTION_TYPES } from '@/lib/finance/types';

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.type !== undefined) {
    if (!FINANCE_TRANSACTION_TYPES.includes(body.type)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction type', 400);
    patch.type = body.type;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return apiError(ErrorCode.VALIDATION_ERROR, 'amount must be greater than zero', 400);
    patch.amount = amount;
  }
  if (body.currency !== undefined) {
    if (!isFinanceCurrency(body.currency)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid currency', 400);
    patch.currency = String(body.currency).toUpperCase();
  }
  if (body.occurred_on !== undefined) {
    if (!validDate(body.occurred_on)) return apiError(ErrorCode.VALIDATION_ERROR, 'occurred_on must be YYYY-MM-DD', 400);
    patch.occurred_on = body.occurred_on;
  }
  if (body.status !== undefined) {
    if (!FINANCE_TRANSACTION_STATUSES.includes(body.status)) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid transaction status', 400);
    patch.status = body.status;
  }
  for (const key of ['category_name', 'merchant', 'description', 'payment_method']) {
    if (body[key] !== undefined) patch[key] = body[key] ? String(body[key]).trim() : null;
  }

  if (Object.keys(patch).length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'No valid fields to update', 400);

  try {
    const transaction = await updateFinancialTransaction(supabase, user.id, id, patch);
    return apiSuccess({ transaction });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update financial transaction';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await context.params;
  try {
    await deleteFinancialTransaction(supabase, user.id, id);
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete financial transaction';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
