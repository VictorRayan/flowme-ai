import type { BillingGateway, GatewayCancellationInput, GatewayCancellationResult, GatewayCheckoutInput, PixQrCheckout } from './contracts';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type AsaasGatewayOptions = {
  apiKey: string;
  baseUrl: string;
  fetcher?: Fetcher;
};

function hasValidCpf(value: string): boolean {
  if (value.length !== 11 || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    const sum = value.slice(0, length).split('').reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function hasValidCnpj(value: string): boolean {
  if (value.length !== 14 || /^(\d)\1+$/.test(value)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((total, char, index) => total + Number(char) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(value[12]) && second === Number(value[13]);
}

export function normalizeCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!hasValidCpf(digits) && !hasValidCnpj(digits)) throw new Error('invalid CPF/CNPJ');
  return digits;
}

function requiredString(record: unknown, key: string): string {
  if (!record || typeof record !== 'object') throw new Error('Asaas returned an invalid response');
  const value = (record as Record<string, unknown>)[key];
  if (typeof value !== 'string' || !value) throw new Error('Asaas returned an invalid response');
  return value;
}

function firstPaymentId(record: unknown): string {
  if (!record || typeof record !== 'object') throw new Error('Asaas did not create the first subscription payment');
  const data = (record as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) throw new Error('Asaas did not create the first subscription payment');
  return requiredString(data[0], 'id');
}

export class AsaasGateway implements BillingGateway {
  readonly provider = 'asaas' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(options: AsaasGatewayOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher || fetch;
  }

  private async request(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> } = {}): Promise<unknown> {
    const method = options.method || (options.body ? 'POST' : 'GET');
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        access_token: this.apiKey,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!response.ok) throw new Error('Asaas rejected the billing request');
    if (response.status === 204) return {};
    return response.json().catch(() => ({})) as Promise<unknown>;
  }

  async createCheckout(input: GatewayCheckoutInput): Promise<PixQrCheckout> {
    if (input.paymentMethod !== 'pix') throw new Error('Asaas gateway only supports Pix checkout');
    const taxId = normalizeCpfCnpj(input.customerTaxId || '');
    let customerId = input.existingCustomerId;
    if (!customerId) {
      const customer = await this.request('/customers', { body: {
        name: input.customerName,
        cpfCnpj: taxId,
        email: input.userEmail,
        externalReference: input.userId,
        notificationDisabled: true,
      } });
      customerId = requiredString(customer, 'id');
    }

    const subscription = await this.request('/subscriptions', { body: {
      customer: customerId,
      billingType: 'PIX',
      nextDueDate: new Date().toISOString().slice(0, 10),
      value: input.amountCents / 100,
      cycle: input.interval === 'annual' ? 'YEARLY' : 'MONTHLY',
      description: input.localizedDescription.slice(0, 500),
      externalReference: input.attemptId,
    } });
    const subscriptionId = requiredString(subscription, 'id');
    const payments = await this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
    const paymentId = firstPaymentId(payments);
    const qrCode = await this.request(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);

    return {
      kind: 'pix_qr_code',
      provider: 'asaas',
      providerCustomerId: customerId,
      providerCheckoutId: subscriptionId,
      providerSubscriptionId: subscriptionId,
      providerPaymentId: paymentId,
      qrCodeBase64: requiredString(qrCode, 'encodedImage'),
      copyPasteCode: requiredString(qrCode, 'payload'),
      expiresAt: requiredString(qrCode, 'expirationDate'),
    };
  }

  async cancelSubscription(input: GatewayCancellationInput): Promise<GatewayCancellationResult> {
    await this.request(`/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}`, { method: 'DELETE' });
    return {
      provider: 'asaas', providerSubscriptionId: input.providerSubscriptionId, state: 'canceled', effectiveAt: new Date().toISOString(),
    };
  }
}

export function getAsaasGateway(): AsaasGateway {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error('ASAAS_API_KEY is not configured');
  return new AsaasGateway({
    apiKey,
    baseUrl: process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3',
  });
}
