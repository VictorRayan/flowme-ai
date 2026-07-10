import {
  CHECKOUT_OFFER_DURATION_SECONDS,
  checkoutCardErrorMessage,
  checkoutCopy,
  checkoutLocaleFromUiLanguage,
  checkoutOfferRemainingSeconds,
  checkoutPixAllowedForInterval,
  checkoutPixAnnualOnlyMessage,
  formatCheckoutCountdown,
} from '@/lib/billing/checkout-ui';

describe('checkout UI state', () => {
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
    expect(checkoutCopy('en-US').cardNumber).toBe('Card number');
    expect(checkoutCopy('pt-BR').cardReady).toContain('diretamente');
  });

  it('limits Pix to the annual checkout interval', () => {
    expect(checkoutPixAllowedForInterval('annual')).toBe(true);
    expect(checkoutPixAllowedForInterval('monthly')).toBe(false);
    expect(checkoutPixAnnualOnlyMessage('pt-BR')).toContain('plano anual');
    expect(checkoutPixAnnualOnlyMessage('en-US')).toContain('annual plan');
  });

  it('localizes safe card errors and hides unknown provider messages', () => {
    expect(checkoutCardErrorMessage('incorrect_cvc', 'pt-BR')).toContain('código de segurança');
    expect(checkoutCardErrorMessage('insufficient_funds', 'en-US')).toContain('available credit');
    expect(checkoutCardErrorMessage('unknown_decline', 'en-US', 'card_declined')).toContain('declined');
    expect(checkoutCardErrorMessage('unknown_provider_code', 'pt-BR')).toBe('Não foi possível iniciar o pagamento.');
  });

  it('formats and bounds the limited-offer countdown', () => {
    expect(CHECKOUT_OFFER_DURATION_SECONDS).toBe(900);
    expect(checkoutOfferRemainingSeconds(901_000, 1_000)).toBe(900);
    expect(checkoutOfferRemainingSeconds(1_001, 1_000)).toBe(1);
    expect(checkoutOfferRemainingSeconds(999, 1_000)).toBe(0);
    expect(formatCheckoutCountdown(900)).toBe('15:00');
    expect(formatCheckoutCountdown(61)).toBe('01:01');
    expect(formatCheckoutCountdown(-1)).toBe('00:00');
  });
});
