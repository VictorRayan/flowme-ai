import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import {
  ACTIVE_SUPPORT_REQUEST_STATUSES,
  isSupportRequestCategory,
  normalizeSupportRequestText,
} from '@/lib/support/requests';

type SupportRequestListItem = {
  id?: unknown;
  type: 'cancellation' | 'support';
  status?: unknown;
  billing_provider?: unknown;
  provider_action_status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  source?: unknown;
  category?: unknown;
  subject?: unknown;
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('subscription_cancellation_requests')
      .select('id,status,reason_code,billing_provider,source,locale,decision,decision_reason,provider_action_status,created_at,updated_at,resolved_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
    const { data: supportRequests, error: supportError } = await admin.from('support_requests')
      .select('id,category,status,subject,source,locale,created_at,updated_at,resolved_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (supportError) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
    const cancellationRequests: SupportRequestListItem[] = (data || []).map((request: Record<string, unknown>) => ({
      ...request,
      type: 'cancellation',
    }));
    const genericRequests: SupportRequestListItem[] = (supportRequests || []).map((request: Record<string, unknown>) => ({
      ...request,
      type: 'support',
    }));
    const requests = [...cancellationRequests, ...genericRequests]
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, 20);
    return apiSuccess({ requests });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const category = isSupportRequestCategory(body.category) ? body.category : null;
    const subject = normalizeSupportRequestText(body.subject);
    const details = normalizeSupportRequestText(body.details);
    const expectedOutcome = normalizeSupportRequestText(body.expected_outcome);
    const locale = body.locale === 'en-US' ? 'en-US' : 'pt-BR';
    const source = body.source === 'billing_page' || body.source === 'mobile' ? body.source : 'support_balys';

    if (!category) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_CATEGORY_REQUIRED', 400);
    if (category === 'payment' && details.length < 24) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_DETAILS_INVALID', 400);
    if (subject.length < 8 || subject.length > 140) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_SUBJECT_INVALID', 400);
    if (details.length < 24 || details.length > 4000) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_DETAILS_INVALID', 400);
    if (expectedOutcome.length < 12 || expectedOutcome.length > 1000) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_OUTCOME_INVALID', 400);

    const { data: existing } = await admin.from('support_requests')
      .select('id,status,category,subject,created_at')
      .eq('user_id', user.id)
      .eq('category', category)
      .in('status', [...ACTIVE_SUPPORT_REQUEST_STATUSES])
      .limit(1)
      .maybeSingle();
    if (existing) return apiError(ErrorCode.VALIDATION_ERROR, 'SUPPORT_REQUEST_ALREADY_OPEN', 409, { request: existing });

    const metadata = category === 'payment'
      ? { requires_billing_review: true }
      : {};
    const { data: created, error } = await admin.from('support_requests').insert({
      user_id: user.id,
      category,
      status: 'open',
      subject,
      details,
      expected_outcome: expectedOutcome,
      locale,
      source,
      metadata,
    }).select('id,category,status,subject,created_at').single();
    if (error) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_REQUEST_CREATE_FAILED', 500);

    if (category === 'payment') {
      const { data: subscription } = await admin.from('user_subscriptions')
        .select('billing_provider,plan_code,status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      await admin.from('billing_admin_alerts').upsert({
        kind: 'payment_failure',
        severity: 'warning',
        user_id: user.id,
        provider: subscription?.billing_provider || null,
        dedupe_key: `support_request_payment:${created.id}`,
        metadata: {
          support_request_id: created.id,
          subject,
          plan: subscription?.plan_code || 'free',
          state: subscription?.status || 'free',
        },
      });
    }

    return apiSuccess({ request: created });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_REQUEST_CREATE_FAILED', 500);
  }
}
