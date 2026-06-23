export const SUPPORT_LOCALES = ['pt-BR', 'en-US'] as const;
export type SupportLocale = typeof SUPPORT_LOCALES[number];

export const FUNNEL_ACTIONS = ['manage_subscription', 'payment_and_recurrence', 'cancel_subscription'] as const;
export type FunnelAction = typeof FUNNEL_ACTIONS[number];
export type FunnelStage = FunnelAction | null;

const ACTION_INDEX = new Map<FunnelAction, number>(FUNNEL_ACTIONS.map((action, index) => [action, index]));

export function normalizeSupportLocale(value: unknown): SupportLocale {
  return value === 'en-US' ? 'en-US' : 'pt-BR';
}

export function isFunnelAction(value: unknown): value is FunnelAction {
  return typeof value === 'string' && FUNNEL_ACTIONS.includes(value as FunnelAction);
}

export function advanceFunnel(currentStage: FunnelStage, action: FunnelAction) {
  const expectedIndex = currentStage === null ? 0 : (ACTION_INDEX.get(currentStage) ?? -1) + 1;
  const requestedIndex = ACTION_INDEX.get(action) ?? -1;
  if (requestedIndex !== expectedIndex && action !== currentStage) {
    return { ok: false as const, code: 'CANCELLATION_FUNNEL_STEP_REQUIRED' as const };
  }
  const nextAction = FUNNEL_ACTIONS[requestedIndex + 1] || null;
  return {
    ok: true as const,
    stage: action,
    nextAction,
    formAvailable: action === 'cancel_subscription',
  };
}

export function isCompletedFunnel(stage: unknown, expiresAt: unknown, now = new Date()): boolean {
  return stage === 'cancel_subscription'
    && typeof expiresAt === 'string'
    && Number.isFinite(Date.parse(expiresAt))
    && Date.parse(expiresAt) > now.getTime();
}
