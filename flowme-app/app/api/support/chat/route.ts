import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { answerSupportQuestion, findSupportKnowledge } from '@/lib/support/knowledge-base';

export function detectsCancellationIntent(message: string): boolean {
  return /\b(cancelar|cancelamento|cancela(?:r)?|não quero mais pagar|unsubscribe|cancel subscription)\b/i.test(message);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 2 || message.length > 4000) return apiError(ErrorCode.VALIDATION_ERROR, 'message must have between 2 and 4000 characters', 400);

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
    const sections = findSupportKnowledge(message);
    const cancellationIntent = detectsCancellationIntent(message);
    return apiSuccess({
      answer: answerSupportQuestion(message, billing),
      sources: sections.map(section => ({ key: section.key, title: section.title })),
      can_escalate: sections.length === 0 || /pagamento|cobrança|payment|billing|cancel/i.test(message),
      intent: cancellationIntent ? 'cancel_subscription' : null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to answer support question', 500);
  }
}
