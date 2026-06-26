import { advanceFunnel, isCompletedFunnel, normalizeSupportLocale } from '@/lib/support/cancellation-funnel';

describe('cancellation funnel', () => {
  it('requires the three stages in order', () => {
    expect(advanceFunnel(null, 'payment_and_recurrence')).toEqual({ ok: false, code: 'CANCELLATION_FUNNEL_STEP_REQUIRED' });
    expect(advanceFunnel(null, 'manage_subscription')).toEqual(expect.objectContaining({ ok: true, nextAction: 'payment_and_recurrence', formAvailable: false }));
    expect(advanceFunnel('manage_subscription', 'payment_and_recurrence')).toEqual(expect.objectContaining({ ok: true, nextAction: 'cancel_subscription' }));
    expect(advanceFunnel('payment_and_recurrence', 'cancel_subscription')).toEqual(expect.objectContaining({ ok: true, nextAction: null, formAvailable: true }));
  });

  it('allows previous-step quick actions after the funnel has advanced without regressing the stage', () => {
    expect(advanceFunnel('cancel_subscription', 'manage_subscription')).toEqual(expect.objectContaining({
      ok: true,
      stage: 'cancel_subscription',
      nextAction: null,
      formAvailable: true,
      repeated: true,
    }));
  });

  it('only accepts a completed, unexpired session', () => {
    expect(isCompletedFunnel('cancel_subscription', '2099-01-01T00:00:00.000Z')).toBe(true);
    expect(isCompletedFunnel('payment_and_recurrence', '2099-01-01T00:00:00.000Z')).toBe(false);
    expect(isCompletedFunnel('cancel_subscription', '2020-01-01T00:00:00.000Z')).toBe(false);
  });

  it('normalizes supported locales', () => {
    expect(normalizeSupportLocale('en-US')).toBe('en-US');
    expect(normalizeSupportLocale('pt-BR')).toBe('pt-BR');
    expect(normalizeSupportLocale('fr')).toBe('pt-BR');
  });
});
