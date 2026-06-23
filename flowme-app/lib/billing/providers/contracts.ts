import type { BillingInterval } from '@/lib/billing/stripe-adapter';
import type { CatalogLocale } from '@/lib/billing/catalog';

export type WebBillingProvider = 'stripe' | 'asaas';
export type WebPaymentMethod = 'pix' | 'card' | 'apple_pay' | 'google_pay';

export type GatewayCheckoutInput = {
  attemptId: string;
  userId: string;
  userEmail: string;
  customerName: string;
  customerTaxId: string | null;
  existingCustomerId: string | null;
  planCode: string;
  localizedName: string;
  localizedDescription: string;
  locale: CatalogLocale;
  interval: BillingInterval;
  paymentMethod: WebPaymentMethod;
  currency: string;
  amountCents: number;
  providerPriceId: string;
  returnUrl: string;
};

export type StripeElementsCheckout = {
  kind: 'stripe_elements';
  provider: 'stripe';
  providerCustomerId: string;
  providerCheckoutId: string;
  providerSubscriptionId: null;
  providerPaymentId: null;
  clientSecret: string;
  expiresAt: string;
};

export type PixQrCheckout = {
  kind: 'pix_qr_code';
  provider: 'asaas';
  providerCustomerId: string;
  providerCheckoutId: string;
  providerSubscriptionId: string;
  providerPaymentId: string;
  qrCodeBase64: string;
  copyPasteCode: string;
  expiresAt: string;
};

export type GatewayCheckoutResult = StripeElementsCheckout | PixQrCheckout;

export type GatewayCancellationInput = {
  providerSubscriptionId: string;
  mode: 'immediate' | 'period_end';
  reason: string;
};

export type GatewayCancellationResult = {
  provider: WebBillingProvider;
  providerSubscriptionId: string;
  state: 'scheduled' | 'canceled';
  effectiveAt: string | null;
};

export interface BillingGateway {
  readonly provider: WebBillingProvider;
  createCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult>;
  cancelSubscription(input: GatewayCancellationInput): Promise<GatewayCancellationResult>;
}
