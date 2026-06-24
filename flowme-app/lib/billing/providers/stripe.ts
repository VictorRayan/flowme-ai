import type Stripe from 'stripe';
import { getStripeClient, stripePriceIdForInterval } from '@/lib/billing/stripe-adapter';
import type { BillingInterval } from '@/lib/billing/stripe-adapter';
import { GatewayCheckoutError } from './contracts';
import type { BillingGateway, GatewayCancellationInput, GatewayCancellationResult, GatewayCheckoutErrorCode, GatewayCheckoutInput, StripeCardCheckout } from './contracts';

type StripeCheckoutFailure = {
  code?: string;
  decline_code?: string;
};

const STRIPE_CHECKOUT_ERROR_CODES: Record<string, GatewayCheckoutErrorCode> = {
  incorrect_cvc: 'incorrect_security_code',
  card_declined: 'card_declined',
  expired_card: 'expired_card',
  incorrect_number: 'invalid_card',
  invalid_number: 'invalid_card',
  invalid_expiry_month: 'invalid_card',
  invalid_expiry_year: 'invalid_card',
  insufficient_funds: 'insufficient_funds',
  generic_decline: 'card_declined',
  do_not_honor: 'card_declined',
  processing_error: 'processing_error',
};

function normalizedStripeCheckoutError(error: unknown): GatewayCheckoutError | null {
  if (!error || typeof error !== 'object') return null;
  const stripeError = error as StripeCheckoutFailure;
  const normalizedCode = [stripeError.decline_code, stripeError.code]
    .map(code => code && STRIPE_CHECKOUT_ERROR_CODES[code])
    .find((code): code is GatewayCheckoutErrorCode => Boolean(code));
  return normalizedCode ? new GatewayCheckoutError(normalizedCode) : null;
}

type StripeClient = {
  customers: {
    create(params: Stripe.CustomerCreateParams): PromiseLike<{ id: string }>;
  };
  paymentMethods: {
    attach(id: string, params: Stripe.PaymentMethodAttachParams): PromiseLike<{ id: string }>;
  };
  subscriptions: {
    create(params: Stripe.SubscriptionCreateParams): PromiseLike<{
      id: string;
      latest_invoice: string | { confirmation_secret?: { client_secret: string } | null } | null;
    }>;
    update(id: string, params: Stripe.SubscriptionUpdateParams): PromiseLike<{ id: string; cancel_at: number | null; cancel_at_period_end: boolean }>;
    cancel(id: string, params?: Stripe.SubscriptionCancelParams): PromiseLike<{ id: string; canceled_at: number | null }>;
  };
};

export class StripeGateway implements BillingGateway {
  readonly provider = 'stripe' as const;
  private readonly stripe: StripeClient;
  private readonly priceIdForInterval: (interval: BillingInterval) => string;

  constructor(options: { stripe: StripeClient; priceIdForInterval?: (interval: BillingInterval) => string }) {
    this.stripe = options.stripe;
    this.priceIdForInterval = options.priceIdForInterval || stripePriceIdForInterval;
  }

  async createCheckout(input: GatewayCheckoutInput): Promise<StripeCardCheckout> {
    if (input.paymentMethod === 'pix') throw new Error('Stripe gateway does not support this checkout method');
    if (!input.providerPaymentMethodId?.startsWith('pm_')) throw new Error('Stripe payment method is invalid');
    let customerId = input.existingCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: input.userEmail,
        name: input.customerName,
        metadata: { user_id: input.userId },
      });
      customerId = customer.id;
    }
    let subscription;
    try {
      await this.stripe.paymentMethods.attach(input.providerPaymentMethodId, { customer: customerId });
      subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: this.priceIdForInterval(input.interval), quantity: 1 }],
        default_payment_method: input.providerPaymentMethodId,
        payment_behavior: 'default_incomplete',
        payment_settings: { payment_method_types: ['card'], save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
        description: input.localizedDescription,
        metadata: {
          checkout_attempt_id: input.attemptId,
          user_id: input.userId,
          plan_code: input.planCode,
          billing_interval: input.interval,
        },
      });
    } catch (error) {
      throw normalizedStripeCheckoutError(error) || error;
    }
    const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
    return {
      kind: 'stripe_card_subscription',
      provider: 'stripe',
      providerCustomerId: customerId,
      providerCheckoutId: subscription.id,
      providerSubscriptionId: subscription.id,
      providerPaymentId: null,
      confirmationClientSecret: invoice?.confirmation_secret?.client_secret || null,
      expiresAt: null,
    };
  }

  async cancelSubscription(input: GatewayCancellationInput): Promise<GatewayCancellationResult> {
    if (input.mode === 'period_end') {
      const subscription = await this.stripe.subscriptions.update(input.providerSubscriptionId, {
        cancel_at_period_end: true,
        metadata: { flowme_cancellation_reason: input.reason.slice(0, 500) },
      });
      return {
        provider: 'stripe', providerSubscriptionId: subscription.id, state: 'scheduled',
        effectiveAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      };
    }
    const subscription = await this.stripe.subscriptions.cancel(input.providerSubscriptionId, { prorate: false, invoice_now: false });
    return {
      provider: 'stripe', providerSubscriptionId: subscription.id, state: 'canceled',
      effectiveAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
    };
  }
}

export function getStripeGateway(): StripeGateway {
  return new StripeGateway({ stripe: getStripeClient() });
}
