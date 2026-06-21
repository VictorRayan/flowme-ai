import { AsaasGateway, normalizeCpfCnpj } from '@/lib/billing/providers/asaas';
import type { GatewayCheckoutInput } from '@/lib/billing/providers/contracts';

const input: GatewayCheckoutInput = {
  attemptId: 'attempt-1',
  userId: 'user-1',
  userEmail: 'victor@example.com',
  customerName: 'Victor Rayan',
  customerTaxId: '529.982.247-25',
  existingCustomerId: null,
  planCode: 'pro',
  localizedName: 'Flow Me Pro',
  localizedDescription: 'Assinatura Flow Me Pro',
  interval: 'monthly',
  paymentMethod: 'pix',
  currency: 'BRL',
  amountCents: 5990,
  providerPriceId: 'asaas_pro_monthly',
  returnUrl: 'https://app.flow-me.online/app/checkout/return',
};

describe('AsaasGateway', () => {
  it('normalizes and validates CPF/CNPJ', () => {
    expect(normalizeCpfCnpj('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpfCnpj('04.252.011/0001-10')).toBe('04252011000110');
    expect(() => normalizeCpfCnpj('111.111.111-11')).toThrow('invalid CPF/CNPJ');
  });

  it('creates customer, Pix subscription, first payment, and QR code', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init || {} });
      const path = String(url);
      if (path.endsWith('/customers')) return Response.json({ id: 'cus_1' });
      if (path.endsWith('/subscriptions')) return Response.json({ id: 'sub_1' });
      if (path.endsWith('/subscriptions/sub_1/payments')) return Response.json({ data: [{ id: 'pay_1', status: 'PENDING' }] });
      return Response.json({ encodedImage: 'base64-image', payload: 'pix-copy-code', expirationDate: '2026-06-22T12:00:00Z' });
    });
    const gateway = new AsaasGateway({ apiKey: 'secret', baseUrl: 'https://api-sandbox.asaas.com/v3', fetcher });

    await expect(gateway.createCheckout(input)).resolves.toEqual({
      kind: 'pix_qr_code',
      provider: 'asaas',
      providerCustomerId: 'cus_1',
      providerCheckoutId: 'sub_1',
      providerSubscriptionId: 'sub_1',
      providerPaymentId: 'pay_1',
      qrCodeBase64: 'base64-image',
      copyPasteCode: 'pix-copy-code',
      expiresAt: '2026-06-22T12:00:00Z',
    });
    expect(requests).toHaveLength(4);
    expect(requests[0].init.headers).toEqual(expect.objectContaining({ access_token: 'secret' }));
    expect(requests[2].init.body).toBeUndefined();
    expect(JSON.parse(String(requests[1].init.body))).toEqual(expect.objectContaining({
      billingType: 'PIX',
      cycle: 'MONTHLY',
      externalReference: 'attempt-1',
      value: 59.9,
    }));
  });

  it('reuses an existing customer and maps provider errors safely', async () => {
    const fetcher = jest.fn(async () => Response.json({ errors: [{ description: 'CPF inválido: 52998224725' }] }, { status: 400 }));
    const gateway = new AsaasGateway({ apiKey: 'secret', baseUrl: 'https://api-sandbox.asaas.com/v3', fetcher });

    await expect(gateway.createCheckout({ ...input, existingCustomerId: 'cus_saved' }))
      .rejects.toThrow('Asaas rejected the billing request');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
