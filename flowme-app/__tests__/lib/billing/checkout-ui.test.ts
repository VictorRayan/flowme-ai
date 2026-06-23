import { checkoutCardErrorMessage, checkoutCopy, checkoutLocaleFromUiLanguage } from '@/lib/billing/checkout-ui';

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

  it('localizes safe card errors and hides unknown provider messages', () => {
    expect(checkoutCardErrorMessage('incorrect_cvc', 'pt-BR')).toContain('código de segurança');
    expect(checkoutCardErrorMessage('insufficient_funds', 'en-US')).toContain('available credit');
    expect(checkoutCardErrorMessage('unknown_decline', 'en-US', 'card_declined')).toContain('declined');
    expect(checkoutCardErrorMessage('unknown_provider_code', 'pt-BR')).toBe('Não foi possível iniciar o pagamento.');
  });
});
