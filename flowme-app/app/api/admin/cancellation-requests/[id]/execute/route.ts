import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';
import { getBillingGateway } from '@/lib/billing/providers/registry';
import type { WebBillingProvider } from '@/lib/billing/providers/contracts';
import { getDefaultFreeEntitlements } from '@/lib/billing/entitlements';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireManagementRole(req, ['billing_manager', 'admin']);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'immediate' ? 'immediate' : 'period_end';
    const admin = getSupabaseAdmin();
    const { data: cancellation, error: cancellationError } = await admin.from('subscription_cancellation_requests')
      .select('id,user_id,subscription_id,billing_provider,status,decision_reason,provider_action_status')
      .eq('id', id).single();
    if (cancellationError || !cancellation) return apiError(ErrorCode.NOT_FOUND, 'CANCELLATION_REQUEST_NOT_FOUND', 404);
    if (cancellation.provider_action_status === 'completed') return apiSuccess({ request: cancellation, idempotent: true });
    if (cancellation.status !== 'approved_cancel' && cancellation.status !== 'provider_action_failed') {
      return apiError(ErrorCode.VALIDATION_ERROR, 'CANCELLATION_NOT_APPROVED', 409);
    }
    const { data: subscription, error: subscriptionError } = await admin.from('user_subscriptions')
      .select('id,user_id,plan_code,billing_provider,provider_subscription_id,status,current_period_start,current_period_end')
      .eq('id', cancellation.subscription_id).single();
    if (subscriptionError || !subscription) return apiError(ErrorCode.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 404);
    if (subscription.billing_provider === 'apple' || subscription.billing_provider === 'google') {
      const { data } = await admin.from('subscription_cancellation_requests').update({
        provider_action_status: 'store_action_required', provider_action_error: null, updated_at: new Date().toISOString(),
      }).eq('id', id).select('*').single();
      return apiSuccess({ request: data, store_action_required: true });
    }
    if (!subscription.provider_subscription_id) return apiError(ErrorCode.VALIDATION_ERROR, 'PROVIDER_SUBSCRIPTION_MISSING', 409);
    await admin.from('subscription_cancellation_requests').update({
      status: 'canceling', provider_action_status: 'pending', provider_action_error: null, updated_at: new Date().toISOString(),
    }).eq('id', id);
    try {
      const gateway = getBillingGateway(subscription.billing_provider as WebBillingProvider);
      const result = await gateway.cancelSubscription({
        providerSubscriptionId: subscription.provider_subscription_id, mode, reason: cancellation.decision_reason || 'manager_approved',
      });
      const now = new Date().toISOString();
      const immediate = mode === 'immediate';
      await admin.from('user_subscriptions').update({
        ...(immediate ? { status: 'canceled' } : { cancel_at_period_end: true }), updated_at: now, last_synced_at: now,
      }).eq('id', subscription.id);
      if (immediate) {
        const free = getDefaultFreeEntitlements(subscription.user_id);
        await admin.from('user_entitlements').upsert({ ...free, updated_at: now }, { onConflict: 'user_id' });
        await admin.from('user_plan_history').update({ transition_reason: 'manager_cancellation', cancellation_request_id: id })
          .eq('user_id', subscription.user_id).eq('plan_code', 'free').is('ended_at', null);
      }
      const { data: updated } = await admin.from('subscription_cancellation_requests').update({
        status: 'canceled', provider_action_status: 'completed', provider_action_id: result.providerSubscriptionId,
        provider_action_completed_at: now, provider_action_error: null, resolved_at: now, updated_at: now,
      }).eq('id', id).select('*').single();
      await admin.from('subscription_cancellation_request_events').insert({
        request_id: id, actor_user_id: user.id, event_type: 'provider_action_completed', from_status: 'canceling', to_status: 'canceled', metadata: { provider: result.provider, mode, state: result.state },
      });
      return apiSuccess({ request: updated, provider_result: result });
    } catch {
      const { data: failed } = await admin.from('subscription_cancellation_requests').update({
        status: 'provider_action_failed', provider_action_status: 'failed', provider_action_error: 'PAYMENT_PROVIDER_ERROR', updated_at: new Date().toISOString(),
      }).eq('id', id).select('*').single();
      await admin.from('subscription_cancellation_request_events').insert({
        request_id: id, actor_user_id: user.id, event_type: 'provider_action_failed', from_status: 'canceling', to_status: 'provider_action_failed', metadata: { mode },
      });
      return apiError(ErrorCode.PAYMENT_PROVIDER_ERROR, 'PAYMENT_PROVIDER_ERROR', 502, { request: failed });
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'CANCELLATION_EXECUTION_FAILED', 500);
  }
}
