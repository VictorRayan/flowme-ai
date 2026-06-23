import { checkoutPresentation, PAYMENT_METHOD_COPY } from '@/lib/billing/checkout-ui';

describe('checkout UI state', () => {
  it('clears a stale Pix checkout when card fields are initialized', () => {
    const card = { kind: 'stripe_elements' as const, clientSecret: 'secret-2' };
    expect(checkoutPresentation(card)).toEqual({ stripeCheckout: card, pixCheckout: null });
  });

  it('clears stale card fields when a Pix QR code is initialized', () => {
    const pix = { kind: 'pix_qr_code' as const, qrCodeBase64: 'image', copyPasteCode: 'code', expiresAt: '2099-01-01T00:00:00Z' };
    expect(checkoutPresentation(pix)).toEqual({ stripeCheckout: null, pixCheckout: pix });
  });

  it('describes payment methods without exposing gateway brands', () => {
    const copy = JSON.stringify(PAYMENT_METHOD_COPY).toLowerCase();
    expect(copy).not.toContain('stripe');
    expect(copy).not.toContain('asaas');
  });
});
