import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { advanceFunnel, isFunnelAction, normalizeSupportLocale, type FunnelAction } from '@/lib/support/cancellation-funnel';
import { answerSupportQuestion, answerSupportQuestionKey, findSupportKnowledge, localizedSupportSource } from '@/lib/support/knowledge-base';

export function detectsCancellationIntent(message: string): boolean {
  return /\b(cancelar|cancelamento|cancela(?:r)?|não quero mais pagar|unsubscribe|cancel subscription)\b/i.test(message);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale = normalizeSupportLocale(body.locale);
    let questionKey: FunnelAction | null = isFunnelAction(body.question_key) ? body.question_key : null;
    if (!questionKey && detectsCancellationIntent(message)) questionKey = 'manage_subscription';
    if (!questionKey && (message.length < 2 || message.length > 4000)) {
      return apiError(ErrorCode.SUPPORT_MESSAGE_INVALID, 'SUPPORT_MESSAGE_INVALID', 400);
    }

    const admin = getSupabaseAdmin();
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
    if (questionKey) {
      const { data: session } = await admin.from('subscription_cancellation_funnel_sessions')
        .select('id,current_stage,completed_stages,expires_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const transition = advanceFunnel(session?.current_stage || null, questionKey);
      if (!transition.ok) {
        return apiError(ErrorCode.CANCELLATION_FUNNEL_STEP_REQUIRED, transition.code, 409, {
          funnel_stage: session?.current_stage || null,
        });
      }
      const completedStages = Array.from(new Set([...(session?.completed_stages || []), questionKey]));
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      let funnelSessionId = session?.id as string | undefined;
      if (funnelSessionId) {
        await admin.from('subscription_cancellation_funnel_sessions').update({
          current_stage: questionKey, completed_stages: completedStages, locale, expires_at: expiresAt, updated_at: new Date().toISOString(),
        }).eq('id', funnelSessionId);
      } else {
        const { data: created, error } = await admin.from('subscription_cancellation_funnel_sessions').insert({
          user_id: user.id, current_stage: questionKey, completed_stages: completedStages, locale, expires_at: expiresAt,
        }).select('id').single();
        if (error || !created?.id) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
        funnelSessionId = created.id;
      }
      return apiSuccess({
        answer: `${answerSupportQuestionKey(questionKey, locale)}\n\n${locale === 'en-US' ? 'Current account' : 'Conta atual'}: ${billing.plan.toUpperCase()} · ${billing.provider || 'Flow Me'} · ${billing.state}.`,
        sources: [],
        can_escalate: true,
        intent: 'cancel_subscription',
        funnel_session_id: funnelSessionId,
        funnel_stage: transition.stage,
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
