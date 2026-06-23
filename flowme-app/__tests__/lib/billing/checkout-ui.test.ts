import { checkoutCopy, checkoutLocaleFromUiLanguage, checkoutMarketCountry, checkoutPresentation } from '@/lib/billing/checkout-ui';

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
    const copy = JSON.stringify([checkoutCopy('pt-BR'), checkoutCopy('en-US')]).toLowerCase();
    expect(copy).not.toContain('stripe');
    expect(copy).not.toContain('asaas');
  });

  it('uses the saved interface language as the checkout locale', () => {
    expect(checkoutLocaleFromUiLanguage('pt')).toBe('pt-BR');
    expect(checkoutLocaleFromUiLanguage('en')).toBe('en-US');
    expect(checkoutLocaleFromUiLanguage(null)).toBe('en-US');
  });

  it('provides complete localized checkout copy', () => {
    expect(checkoutCopy('pt-BR').headline).toBe('Como você quer pagar?');
    expect(checkoutCopy('en-US').headline).toBe('How would you like to pay?');
    expect(checkoutCopy('en-US').cardDetail).toContain('Apple Pay');
  });

  it('offers Pix only for the Brazilian market independently of UI language', () => {
    expect(checkoutMarketCountry('America/Sao_Paulo', ['en-US'])).toBe('BR');
    expect(checkoutMarketCountry('Europe/Lisbon', ['pt-PT'])).toBe('OTHER');
    expect(checkoutMarketCountry('UTC', ['pt-BR'])).toBe('BR');
    expect(checkoutMarketCountry('America/New_York', ['en-US'])).toBe('OTHER');
  });
});
