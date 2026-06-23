import { timingSafeEqual } from 'node:crypto';
import type { SubscriptionStatus } from '@/lib/billing/entitlements';

export type AsaasAttemptStatus = 'paid' | 'past_due' | 'failed' | 'canceled' | 'refunded' | null;

export type NormalizedAsaasEvent = {
  id: string;
  type: string;
  occurredAt: string;
  status: SubscriptionStatus | null;
  attemptStatus: AsaasAttemptStatus;
  paymentId: string;
  customerId: string | null;
  subscriptionId: string | null;
  externalReference: string | null;
  paymentDate: string | null;
  amountCents: number | null;
  currency: string;
  raw: Record<string, unknown>;
};

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value ? value : null;
}

export function verifyAsaasWebhookToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function normalizeAsaasEvent(value: unknown): NormalizedAsaasEvent {
  if (!value || typeof value !== 'object') throw new Error('Invalid Asaas webhook event');
  const raw = value as Record<string, unknown>;
  const id = optionalString(raw, 'id');
  const type = optionalString(raw, 'event');
  const paymentValue = raw.payment;
  if (!id || !type || !paymentValue || typeof paymentValue !== 'object') throw new Error('Invalid Asaas webhook event');
  const payment = paymentValue as Record<string, unknown>;
  const paymentId = optionalString(payment, 'id');
  if (!paymentId) throw new Error('Invalid Asaas webhook event');

  let status: SubscriptionStatus | null = null;
  let attemptStatus: AsaasAttemptStatus = null;
  if (type === 'PAYMENT_RECEIVED') {
    status = 'active';
    attemptStatus = 'paid';
  } else if (type === 'PAYMENT_OVERDUE') {
    status = 'past_due';
    attemptStatus = 'past_due';
  } else if (type === 'PAYMENT_REFUNDED' || type === 'PAYMENT_PARTIALLY_REFUNDED') {
    status = 'expired';
    attemptStatus = 'refunded';
  } else if (type === 'PAYMENT_DELETED') {
    status = 'expired';
    attemptStatus = 'canceled';
  } else if (type.includes('CHARGEBACK') || type === 'PAYMENT_RECEIVED_IN_CASH_UNDONE') {
    status = 'expired';
    attemptStatus = 'failed';
  }

  const occurredAt = optionalString(raw, 'dateCreated') || new Date().toISOString();
  return {
    id,
    type,
    occurredAt,
    status,
    attemptStatus,
    paymentId,
    customerId: optionalString(payment, 'customer'),
    subscriptionId: optionalString(payment, 'subscription'),
    externalReference: optionalString(payment, 'externalReference'),
    paymentDate: optionalString(payment, 'paymentDate') || optionalString(payment, 'clientPaymentDate'),
    amountCents: typeof payment.value === 'number' && Number.isFinite(payment.value) ? Math.round(payment.value * 100) : null,
    currency: 'BRL',
    raw,
  };
}

export function asaasPeriodEnd(startValue: string | null, interval: 'monthly' | 'annual', now = new Date()): string {
  const start = startValue && Number.isFinite(Date.parse(startValue)) ? new Date(startValue) : now;
  const end = new Date(start);
  if (interval === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}
