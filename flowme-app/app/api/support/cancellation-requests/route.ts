import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { logSupabaseRouteError } from '@/lib/api/supabase-error-log';

const VALID_SOURCES = ['support_balys', 'billing_page', 'mobile'] as const;

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validationError(message: string) {
  return apiError(ErrorCode.VALIDATION_ERROR, message, 400);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const reason = normalizedText(body.reason);
    const disappointingFeatures = normalizedText(body.disappointing_features);
    const unmetExpectation = normalizedText(body.unmet_expectation);
    const source = VALID_SOURCES.includes(body.source) ? body.source : 'support_balys';

    if (reason.length < 100) return validationError('reason must have at least 100 characters');
    if (disappointingFeatures.length < 10) return validationError('disappointing_features must have at least 10 characters');
    if (unmetExpectation.length < 10) return validationError('unmet_expectation must have at least 10 characters');
    if (typeof body.would_accept_human_support !== 'boolean') return validationError('would_accept_human_support must be boolean');

    const { data: subscription, error: subscriptionError } = await admin
      .from('user_subscriptions')
      .select('id,billing_provider')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      logSupabaseRouteError('/api/support/cancellation-requests', 'user_subscriptions', subscriptionError);
      return apiError(ErrorCode.SUPABASE_ERROR, subscriptionError.message, 500);
    }

    const { data, error } = await admin
      .from('subscription_cancellation_requests')
      .insert({
        user_id: user.id,
        subscription_id: subscription?.id || null,
        billing_provider: subscription?.billing_provider || null,
        reason,
        disappointing_features: disappointingFeatures,
        unmet_expectation: unmetExpectation,
        would_accept_human_support: body.would_accept_human_support,
        source,
        status: 'open',
      })
      .select('id,status,created_at')
      .single();

    if (error) {
      logSupabaseRouteError('/api/support/cancellation-requests', 'subscription_cancellation_requests', error);
      return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }
    return apiSuccess({ request: data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to create cancellation request';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
