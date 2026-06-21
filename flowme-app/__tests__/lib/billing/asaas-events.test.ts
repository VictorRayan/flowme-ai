import { normalizeAsaasEvent, verifyAsaasWebhookToken } from '@/lib/billing/providers/asaas-events';

describe('Asaas webhook events', () => {
  it('uses constant-time compatible token validation', () => {
    expect(verifyAsaasWebhookToken('strong-token', 'strong-token')).toBe(true);
    expect(verifyAsaasWebhookToken('wrong', 'strong-token')).toBe(false);
    expect(verifyAsaasWebhookToken(null, 'strong-token')).toBe(false);
  });

  it('grants access only for PAYMENT_RECEIVED', () => {
    expect(normalizeAsaasEvent({ id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', customer: 'cus_1', subscription: 'sub_1', externalReference: 'attempt-1' } }))
      .toEqual(expect.objectContaining({ status: 'active', attemptStatus: 'paid' }));
    expect(normalizeAsaasEvent({ id: 'evt_2', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } }))
      .toEqual(expect.objectContaining({ status: null, attemptStatus: null }));
  });

  it.each([
    ['PAYMENT_OVERDUE', 'past_due', 'past_due'],
    ['PAYMENT_REFUNDED', 'expired', 'refunded'],
    ['PAYMENT_DELETED', 'expired', 'canceled'],
    ['PAYMENT_CHARGEBACK_REQUESTED', 'expired', 'failed'],
  ])('normalizes %s', (event, status, attemptStatus) => {
    expect(normalizeAsaasEvent({ id: 'evt', event, payment: { id: 'pay' } }))
      .toEqual(expect.objectContaining({ status, attemptStatus }));
  });

  it('rejects malformed event envelopes', () => {
    expect(() => normalizeAsaasEvent({ event: 'PAYMENT_RECEIVED' })).toThrow('Invalid Asaas webhook event');
  });
});
