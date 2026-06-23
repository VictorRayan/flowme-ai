import { StripeGateway } from '@/lib/billing/providers/stripe';
import type { GatewayCheckoutInput } from '@/lib/billing/providers/contracts';

const input: GatewayCheckoutInput = {
  attemptId: 'attempt-1',
  userId: 'user-1',
  userEmail: 'victor@example.com',
  customerName: 'Victor Rayan',
  customerTaxId: null,
  existingCustomerId: null,
  planCode: 'pro',
  localizedName: 'Flow Me Pro',
  localizedDescription: 'Flow Me Pro subscription',
  locale: 'en-US',
  interval: 'annual',
  paymentMethod: 'card',
  currency: 'BRL',
  amountCents: 47880,
  providerPriceId: 'price_annual',
  returnUrl: 'https://app.flow-me.online/app/checkout/return',
};

describe('StripeGateway', () => {
  it('creates an Elements subscription session and returns its client secret', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cus_1' });
    const createSession = jest.fn().mockResolvedValue({
      id: 'cs_1',
      client_secret: 'cs_secret_1',
      expires_at: 1_800_000_000,
    });
    const gateway = new StripeGateway({
      stripe: { customers: { create: createCustomer }, checkout: { sessions: { create: createSession } }, subscriptions: { update: jest.fn(), cancel: jest.fn() } },
      priceIdForInterval: interval => interval === 'annual' ? 'price_live_annual' : 'price_live_monthly',
    });

    await expect(gateway.createCheckout(input)).resolves.toEqual({
      kind: 'stripe_elements',
      provider: 'stripe',
      providerCustomerId: 'cus_1',
      providerCheckoutId: 'cs_1',
      providerSubscriptionId: null,
      providerPaymentId: null,
      clientSecret: 'cs_secret_1',
      expiresAt: new Date(1_800_000_000 * 1000).toISOString(),
    });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      ui_mode: 'elements',
      customer: 'cus_1',
      line_items: [{ price: 'price_live_annual', quantity: 1 }],
      locale: 'en',
    }));
  });

  it('reuses an existing customer', async () => {
    const createCustomer = jest.fn();
    const createSession = jest.fn().mockResolvedValue({ id: 'cs_1', client_secret: 'secret', expires_at: 1_800_000_000 });
    const gateway = new StripeGateway({ stripe: { customers: { create: createCustomer }, checkout: { sessions: { create: createSession } }, subscriptions: { update: jest.fn(), cancel: jest.fn() } }, priceIdForInterval: () => 'price_live_annual' });
    await gateway.createCheckout({ ...input, existingCustomerId: 'cus_saved' });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_saved' }));
  });

  it('uses the configured Stripe price instead of a stale catalog provider ID', async () => {
    const createSession = jest.fn().mockResolvedValue({ id: 'cs_1', client_secret: 'secret', expires_at: 1_800_000_000 });
    const gateway = new StripeGateway({
      stripe: { customers: { create: jest.fn().mockResolvedValue({ id: 'cus_1' }) }, checkout: { sessions: { create: createSession } }, subscriptions: { update: jest.fn(), cancel: jest.fn() } },
      priceIdForInterval: () => 'price_from_production_secret',
    });

    await gateway.createCheckout({ ...input, providerPriceId: 'price_MENSAL_REAL', interval: 'monthly', locale: 'pt-BR' });

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: 'price_from_production_secret', quantity: 1 }],
      locale: 'pt-BR',
    }));
  });

  it('schedules cancellation through the provider port', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'sub_1', cancel_at: 1_800_000_000, cancel_at_period_end: true });
    const gateway = new StripeGateway({
      stripe: { customers: { create: jest.fn() }, checkout: { sessions: { create: jest.fn() } }, subscriptions: { update, cancel: jest.fn() } },
    });
    await expect(gateway.cancelSubscription({ providerSubscriptionId: 'sub_1', mode: 'period_end', reason: 'approved' }))
      .resolves.toEqual(expect.objectContaining({ provider: 'stripe', state: 'scheduled', providerSubscriptionId: 'sub_1' }));
    expect(update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ cancel_at_period_end: true }));
  });
});
