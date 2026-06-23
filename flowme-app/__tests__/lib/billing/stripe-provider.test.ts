import { StripeGateway } from '@/lib/billing/providers/stripe';
import type { GatewayCheckoutInput } from '@/lib/billing/providers/contracts';

const input: GatewayCheckoutInput = {
  attemptId: 'attempt-1', userId: 'user-1', userEmail: 'victor@example.com', customerName: 'Victor Rayan',
  customerTaxId: null, existingCustomerId: null, planCode: 'pro', localizedName: 'Flow Me Pro',
  localizedDescription: 'Flow Me Pro subscription', locale: 'en-US', interval: 'annual', paymentMethod: 'card',
  currency: 'BRL', amountCents: 47880, providerPriceId: 'price_annual', providerPaymentMethodId: 'pm_card_1',
  returnUrl: 'https://app.flow-me.online/app/checkout/return',
};

function stripeClient(overrides: Record<string, unknown> = {}) {
  return {
    customers: { create: jest.fn().mockResolvedValue({ id: 'cus_1' }) },
    paymentMethods: { attach: jest.fn().mockResolvedValue({ id: 'pm_card_1' }) },
    subscriptions: { create: jest.fn().mockResolvedValue({ id: 'sub_1', latest_invoice: null }), update: jest.fn(), cancel: jest.fn() },
    ...overrides,
  };
}

describe('StripeGateway', () => {
  it('attaches a tokenized PaymentMethod and creates an incomplete subscription', async () => {
    const attach = jest.fn().mockResolvedValue({ id: 'pm_card_1' });
    const create = jest.fn().mockResolvedValue({ id: 'sub_1', latest_invoice: { confirmation_secret: { client_secret: 'pi_secret_1' } } });
    const gateway = new StripeGateway({
      stripe: stripeClient({ paymentMethods: { attach }, subscriptions: { create, update: jest.fn(), cancel: jest.fn() } }),
      priceIdForInterval: interval => interval === 'annual' ? 'price_live_annual' : 'price_live_monthly',
    });

    await expect(gateway.createCheckout(input)).resolves.toEqual({
      kind: 'stripe_card_subscription', provider: 'stripe', providerCustomerId: 'cus_1', providerCheckoutId: 'sub_1',
      providerSubscriptionId: 'sub_1', providerPaymentId: null, confirmationClientSecret: 'pi_secret_1', expiresAt: null,
    });
    expect(attach).toHaveBeenCalledWith('pm_card_1', { customer: 'cus_1' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_1', items: [{ price: 'price_live_annual', quantity: 1 }], default_payment_method: 'pm_card_1',
      payment_behavior: 'default_incomplete',
      payment_settings: { payment_method_types: ['card'], save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret'],
    }));
  });

  it('reuses an existing customer and configured Stripe price', async () => {
    const customers = { create: jest.fn() };
    const create = jest.fn().mockResolvedValue({ id: 'sub_1', latest_invoice: null });
    const gateway = new StripeGateway({ stripe: stripeClient({ customers, subscriptions: { create, update: jest.fn(), cancel: jest.fn() } }), priceIdForInterval: () => 'price_from_secret' });
    await gateway.createCheckout({ ...input, existingCustomerId: 'cus_saved', providerPriceId: 'price_STALE' });
    expect(customers.create).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_saved', items: [{ price: 'price_from_secret', quantity: 1 }] }));
  });

  it('rejects anything other than an opaque Stripe PaymentMethod ID', async () => {
    const gateway = new StripeGateway({ stripe: stripeClient(), priceIdForInterval: () => 'price_live' });
    await expect(gateway.createCheckout({ ...input, providerPaymentMethodId: '4242424242424242' })).rejects.toThrow('Stripe payment method is invalid');
  });

  it('normalizes an incorrect CVC without exposing the Stripe error', async () => {
    const create = jest.fn().mockRejectedValue({
      type: 'StripeCardError', code: 'card_declined', decline_code: 'incorrect_cvc', message: 'raw provider message',
    });
    const gateway = new StripeGateway({
      stripe: stripeClient({ subscriptions: { create, update: jest.fn(), cancel: jest.fn() } }),
      priceIdForInterval: () => 'price_live',
    });

    await expect(gateway.createCheckout(input)).rejects.toMatchObject({
      name: 'GatewayCheckoutError', code: 'incorrect_security_code', message: 'incorrect_security_code',
    });
  });

  it('schedules cancellation through the provider port', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'sub_1', cancel_at: 1_800_000_000, cancel_at_period_end: true });
    const gateway = new StripeGateway({ stripe: stripeClient({ subscriptions: { create: jest.fn(), update, cancel: jest.fn() } }) });
    await expect(gateway.cancelSubscription({ providerSubscriptionId: 'sub_1', mode: 'period_end', reason: 'approved' }))
      .resolves.toEqual(expect.objectContaining({ provider: 'stripe', state: 'scheduled', providerSubscriptionId: 'sub_1' }));
  });
});
