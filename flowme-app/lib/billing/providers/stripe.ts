import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/billing/stripe-adapter';
import type { BillingGateway, GatewayCheckoutInput, StripeElementsCheckout } from './contracts';

type StripeClient = {
  customers: {
    create(params: Stripe.CustomerCreateParams): PromiseLike<{ id: string }>;
  };
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): PromiseLike<{
        id: string;
        client_secret: string | null;
        expires_at: number;
      }>;
    };
  };
};

export class StripeGateway implements BillingGateway {
  readonly provider = 'stripe' as const;
  private readonly stripe: StripeClient;

  constructor(options: { stripe: StripeClient }) {
    this.stripe = options.stripe;
  }

  async createCheckout(input: GatewayCheckoutInput): Promise<StripeElementsCheckout> {
    if (input.paymentMethod === 'pix') throw new Error('Stripe gateway does not support this checkout method');
    let customerId = input.existingCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: input.userEmail,
        name: input.customerName,
        metadata: { user_id: input.userId },
      });
      customerId = customer.id;
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'elements',
      customer: customerId,
      line_items: [{ price: input.providerPriceId, quantity: 1 }],
      return_url: `${input.returnUrl}?attempt_id=${encodeURIComponent(input.attemptId)}&session_id={CHECKOUT_SESSION_ID}`,
      client_reference_id: input.userId,
      metadata: {
        checkout_attempt_id: input.attemptId,
        user_id: input.userId,
        plan_code: input.planCode,
        billing_interval: input.interval,
      },
      subscription_data: {
        metadata: {
          checkout_attempt_id: input.attemptId,
          user_id: input.userId,
          plan_code: input.planCode,
          billing_interval: input.interval,
        },
      },
    });
    if (!session.client_secret) throw new Error('Stripe did not return a checkout client secret');
    return {
      kind: 'stripe_elements',
      provider: 'stripe',
      providerCustomerId: customerId,
      providerCheckoutId: session.id,
      providerSubscriptionId: null,
      providerPaymentId: null,
      clientSecret: session.client_secret,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    };
  }
}

export function getStripeGateway(): StripeGateway {
  return new StripeGateway({ stripe: getStripeClient() });
}
