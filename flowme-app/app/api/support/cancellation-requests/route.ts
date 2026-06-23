import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { logSupabaseRouteError } from '@/lib/api/supabase-error-log';
import { isCompletedFunnel, normalizeSupportLocale } from '@/lib/support/cancellation-funnel';

const VALID_SOURCES = ['support_balys', 'billing_page', 'mobile'] as const;
const VALID_REASONS = ['price', 'technical_problem', 'not_using', 'unmet_expectation', 'privacy', 'other'] as const;
const ACTIVE_STATUSES = ['open', 'in_review', 'needs_info', 'approved_cancel', 'canceling', 'provider_action_failed'];

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validationError(code: ErrorCode, field: string) {
  return apiError(code, code, 400, { field_errors: { [field]: code } });
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
    const reasonCode = VALID_REASONS.includes(body.reason_code) ? body.reason_code : '';
    const funnelSessionId = normalizedText(body.funnel_session_id);
    const locale = normalizeSupportLocale(body.locale);

    if (!funnelSessionId) return apiError(ErrorCode.CANCELLATION_FUNNEL_REQUIRED, 'CANCELLATION_FUNNEL_REQUIRED', 409);
    if (!reasonCode) return validationError(ErrorCode.CANCELLATION_REASON_REQUIRED, 'reason_code');
    if (reason.length < 100) return validationError(ErrorCode.CANCELLATION_REASON_REQUIRED, 'reason');
    if (disappointingFeatures.length < 10) return validationError(ErrorCode.CANCELLATION_DETAILS_INVALID, 'disappointing_features');
    if (unmetExpectation.length < 10) return validationError(ErrorCode.CANCELLATION_DETAILS_INVALID, 'unmet_expectation');
    if (typeof body.would_accept_human_support !== 'boolean') return validationError(ErrorCode.CANCELLATION_DETAILS_INVALID, 'would_accept_human_support');

    const { data: funnelSession } = await admin.from('subscription_cancellation_funnel_sessions')
      .select('id,current_stage,expires_at')
      .eq('id', funnelSessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!funnelSession || !isCompletedFunnel(funnelSession.current_stage, funnelSession.expires_at)) {
      return apiError(ErrorCode.CANCELLATION_FUNNEL_REQUIRED, 'CANCELLATION_FUNNEL_REQUIRED', 409);
    }

    const { data: existing } = await admin.from('subscription_cancellation_requests')
      .select('id,status,created_at')
      .eq('user_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();
    if (existing) return apiError(ErrorCode.CANCELLATION_ALREADY_OPEN, 'CANCELLATION_ALREADY_OPEN', 409, { request: existing });

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
        funnel_session_id: funnelSessionId,
        reason_code: reasonCode,
        reason,
        disappointing_features: disappointingFeatures,
        unmet_expectation: unmetExpectation,
        would_accept_human_support: body.would_accept_human_support,
        source,
        locale,
        status: 'open',
      })
      .select('id,status,created_at')
      .single();

    if (error) {
      logSupabaseRouteError('/api/support/cancellation-requests', 'subscription_cancellation_requests', error);
      return apiError(ErrorCode.CANCELLATION_CREATE_FAILED, 'CANCELLATION_CREATE_FAILED', 500);
    }
    const { error: alertError } = await admin.from('billing_admin_alerts').insert({
      kind: 'cancellation_request',
      severity: 'warning',
      user_id: user.id,
      provider: subscription?.billing_provider || null,
      dedupe_key: `cancellation_request:${data.id}`,
      metadata: { cancellation_request_id: data.id, source },
    });
    if (alertError) logSupabaseRouteError('/api/support/cancellation-requests', 'billing_admin_alerts', alertError);
    await admin.from('subscription_cancellation_request_events').insert({
      request_id: data.id, actor_user_id: user.id, event_type: 'submitted', to_status: 'open', metadata: { source, locale },
    });
    return apiSuccess({ request: data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.CANCELLATION_CREATE_FAILED, 'CANCELLATION_CREATE_FAILED', 500);
  }
}
