import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const EVENT_TYPES = ['started', 'step_viewed', 'step_completed', 'completed'] as const;
const LOCALES = ['pt-BR', 'en-US'] as const;

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const eventType = EVENT_TYPES.includes(body.event_type as typeof EVENT_TYPES[number]) ? body.event_type as typeof EVENT_TYPES[number] : null;
    const stepKey = text(body.step_key, 80);
    const stepIndex = Number.isFinite(Number(body.step_index)) ? Math.max(0, Math.round(Number(body.step_index))) : 0;
    const locale = LOCALES.includes(body.locale as typeof LOCALES[number]) ? body.locale as typeof LOCALES[number] : null;
    if (!eventType || !stepKey) return apiError(ErrorCode.VALIDATION_ERROR, 'event_type and step_key are required', 400);

    const metadata = typeof body.metadata === 'object' && body.metadata !== null && !Array.isArray(body.metadata) ? body.metadata : {};
    const { error } = await supabase.from('onboarding_events').insert({
      user_id: user.id,
      email: user.email || null,
      session_id: text(body.session_id, 120),
      event_type: eventType,
      step_key: stepKey,
      step_index: stepIndex,
      locale,
      metadata,
    });
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to record onboarding event', 500);
    return apiSuccess({ recorded: true });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Unable to record onboarding event', 500);
  }
}
