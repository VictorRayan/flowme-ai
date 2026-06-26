import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { advanceFunnel, isFunnelAction, normalizeSupportLocale, type FunnelAction } from '@/lib/support/cancellation-funnel';
import { answerSupportQuestion, answerSupportQuestionKey, detectsPaymentSupportIntent, findSupportKnowledge, localizedSupportSource, paymentSupportAnswer } from '@/lib/support/knowledge-base';
import { recordBillingAdminAlert } from '@/lib/billing/admin-alerts';

export function detectsCancellationIntent(message: string): boolean {
  return /\b(cancelar|cancelamento|cancela(?:r)?|não quero mais pagar|unsubscribe|cancel subscription)\b/i.test(message);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale = normalizeSupportLocale(body.locale);
    const explicitQuestionKey: FunnelAction | null = isFunnelAction(body.question_key) ? body.question_key : null;
    if (!explicitQuestionKey && (message.length < 2 || message.length > 4000)) {
      return apiError(ErrorCode.SUPPORT_MESSAGE_INVALID, 'SUPPORT_MESSAGE_INVALID', 400);
    }

    const admin = getSupabaseAdmin();
    const { data: session } = await admin.from('subscription_cancellation_funnel_sessions')
      .select('id,current_stage,completed_stages,expires_at')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let questionKey: FunnelAction | null = explicitQuestionKey;
    if (!questionKey && detectsCancellationIntent(message)) {
      questionKey = session?.current_stage === 'manage_subscription'
        ? 'payment_and_recurrence'
        : session?.current_stage === 'payment_and_recurrence'
          ? 'cancel_subscription'
          : 'manage_subscription';
    }
    const { data: subscription } = await admin.from('user_subscriptions')
      .select('plan_code,billing_provider,status')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const billing = {
      plan: subscription?.plan_code || 'free',
      provider: subscription?.billing_provider || null,
      state: subscription?.status || 'free',
    };
    if (!questionKey && detectsPaymentSupportIntent(message)) {
      await recordBillingAdminAlert(admin, {
        kind: 'payment_failure',
        severity: 'warning',
        userId: user.id,
        provider: billing.provider === 'stripe' || billing.provider === 'asaas' || billing.provider === 'apple' || billing.provider === 'google' ? billing.provider : null,
        dedupeKey: `support-payment:${user.id}:${new Date().toISOString().slice(0, 10)}`,
        metadata: { source: 'support_chat', message_preview: message.slice(0, 500), plan: billing.plan, state: billing.state },
      });
      return apiSuccess({
        answer: paymentSupportAnswer(billing, locale),
        sources: [{ key: 'billing', title: locale === 'en-US' ? 'Billing and payment' : 'Cobrança e pagamento' }],
        can_escalate: true,
        intent: 'payment_support',
        next_actions: [],
        cancellation_form_available: false,
        support_ticket: { type: 'payment_problem', status: 'open' },
      });
    }
    if (questionKey) {
      const transition = advanceFunnel(session?.current_stage || null, questionKey);
      if (!transition.ok) {
        if (!explicitQuestionKey || session?.current_stage) {
          const currentStage = session?.current_stage as FunnelAction | undefined;
          const nextAction = currentStage === 'manage_subscription'
            ? 'payment_and_recurrence'
            : currentStage === 'payment_and_recurrence'
              ? 'cancel_subscription'
              : null;
          return apiSuccess({
            answer: currentStage
              ? `${answerSupportQuestionKey(currentStage, locale)}\n\n${locale === 'en-US' ? 'You are already in this subscription flow. Continue with the next step below.' : 'Você já está neste fluxo de assinatura. Continue pela próxima etapa abaixo.'}`
              : answerSupportQuestion(message, billing, locale),
            sources: [],
            can_escalate: true,
            intent: 'cancel_subscription',
            funnel_session_id: session?.id || null,
            funnel_stage: session?.current_stage || null,
            next_actions: nextAction ? [nextAction] : [],
            cancellation_form_available: session?.current_stage === 'cancel_subscription',
          });
        }
        return apiError(ErrorCode.CANCELLATION_FUNNEL_STEP_REQUIRED, transition.code, 409, {
          funnel_stage: session?.current_stage || null,
        });
      }
      const completedStages = Array.from(new Set([...(session?.completed_stages || []), questionKey]));
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      let funnelSessionId = session?.id as string | undefined;
      const responseStage = transition.stage || questionKey;
      if (funnelSessionId) {
        await admin.from('subscription_cancellation_funnel_sessions').update({
          current_stage: responseStage, completed_stages: Array.from(new Set([...(session?.completed_stages || []), responseStage])), locale, expires_at: expiresAt, updated_at: new Date().toISOString(),
        }).eq('id', funnelSessionId);
      } else {
        const { data: created, error } = await admin.from('subscription_cancellation_funnel_sessions').insert({
          user_id: user.id, current_stage: responseStage, completed_stages: completedStages, locale, expires_at: expiresAt,
        }).select('id').single();
        if (error || !created?.id) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
        funnelSessionId = created.id;
      }
      return apiSuccess({
        answer: `${answerSupportQuestionKey(responseStage, locale)}\n\n${locale === 'en-US' ? 'Current account' : 'Conta atual'}: ${billing.plan.toUpperCase()} · ${billing.provider || 'Flow Me'} · ${billing.state}.`,
        sources: [],
        can_escalate: true,
        intent: 'cancel_subscription',
        funnel_session_id: funnelSessionId,
        funnel_stage: responseStage,
        next_actions: transition.nextAction ? [transition.nextAction] : [],
        cancellation_form_available: transition.formAvailable,
      });
    }
    const sections = findSupportKnowledge(message);
    return apiSuccess({
      answer: answerSupportQuestion(message, billing, locale),
      sources: sections.map(section => localizedSupportSource(section, locale)),
      can_escalate: sections.length === 0 || /pagamento|cobrança|payment|billing|cancel/i.test(message),
      intent: null,
      next_actions: [],
      cancellation_form_available: false,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
  }
}
