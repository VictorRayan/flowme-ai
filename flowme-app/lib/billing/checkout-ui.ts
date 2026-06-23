export type CheckoutPresentation = {
  stripeCheckout: { kind: 'stripe_elements'; clientSecret: string } | null;
  pixCheckout: { kind: 'pix_qr_code'; qrCodeBase64: string; copyPasteCode: string; expiresAt: string } | null;
};

export type CheckoutLocale = 'pt-BR' | 'en-US';
export type CheckoutMarketCountry = 'BR' | 'OTHER';

const BRAZIL_TIMEZONES = new Set([
  'America/Araguaina', 'America/Bahia', 'America/Belem', 'America/Boa_Vista',
  'America/Campo_Grande', 'America/Cuiaba', 'America/Eirunepe', 'America/Fortaleza',
  'America/Maceio', 'America/Manaus', 'America/Noronha', 'America/Porto_Velho',
  'America/Recife', 'America/Rio_Branco', 'America/Santarem', 'America/Sao_Paulo',
]);

const CHECKOUT_COPY = {
  'pt-BR': {
    headline: 'Como você quer pagar?',
    paymentPrompt: 'Escolha uma opção segura para concluir.',
    pixTitle: 'Pix',
    pixDetail: 'QR Code · aprovação rápida',
    cardTitle: 'Cartão',
    cardDetail: 'Cartão · Apple Pay · Google Pay',
    quickPayment: 'Pagamento rápido',
    cardDivider: 'ou pague com cartão',
    subscribe: 'Assinar Flow Me Pro',
    loadPayment: 'Carregar pagamento seguro',
    monthly: 'Mensal',
    annual: 'Anual',
    perMonth: '/mês',
    save: 'Economize',
    perYear: 'por ano',
    fullName: 'Nome completo',
    taxId: 'CPF ou CNPJ',
    taxIdHelp: 'Necessário para emitir a cobrança Pix com segurança.',
    protectedPayment: 'Pagamento protegido. Cancele quando quiser.',
    pixHeading: 'Escaneie o QR Code Pix',
    copyPix: 'Copiar código Pix',
    pixConfirmation: 'A confirmação acontece automaticamente após o pagamento. Não feche esta tela.',
    confirmed: 'Pagamento confirmado!',
    released: 'Seu Flow Me Pro está liberado.',
    enterApp: 'Entrar no Flow Me',
    unavailablePlan: 'Plano Pro indisponível.',
    checkoutLoadError: 'Não foi possível carregar o checkout.',
    paymentStartError: 'Não foi possível iniciar o pagamento.',
  },
  'en-US': {
    headline: 'How would you like to pay?',
    paymentPrompt: 'Choose a secure option to complete your purchase.',
    pixTitle: 'Pix',
    pixDetail: 'QR code · fast approval',
    cardTitle: 'Card',
    cardDetail: 'Card · Apple Pay · Google Pay',
    quickPayment: 'Express payment',
    cardDivider: 'or pay by card',
    subscribe: 'Subscribe to Flow Me Pro',
    loadPayment: 'Load secure payment',
    monthly: 'Monthly',
    annual: 'Annual',
    perMonth: '/month',
    save: 'Save',
    perYear: 'per year',
    fullName: 'Full name',
    taxId: 'CPF or CNPJ',
    taxIdHelp: 'Required to securely issue the Pix charge.',
    protectedPayment: 'Secure payment. Cancel anytime.',
    pixHeading: 'Scan the Pix QR code',
    copyPix: 'Copy Pix code',
    pixConfirmation: 'Payment confirmation is automatic. Keep this page open.',
    confirmed: 'Payment confirmed!',
    released: 'Your Flow Me Pro access is ready.',
    enterApp: 'Open Flow Me',
    unavailablePlan: 'Flow Me Pro is unavailable.',
    checkoutLoadError: 'Unable to load checkout.',
    paymentStartError: 'Unable to start payment.',
  },
} as const;

export function checkoutLocaleFromUiLanguage(language: string | null | undefined): CheckoutLocale {
  return language === 'pt' ? 'pt-BR' : 'en-US';
}

export function checkoutMarketCountry(timezone: string | null | undefined, browserLanguages: readonly string[]): CheckoutMarketCountry {
  if (timezone && BRAZIL_TIMEZONES.has(timezone)) return 'BR';
  return browserLanguages.some(language => /(^|-)BR$/i.test(language)) ? 'BR' : 'OTHER';
}

export function checkoutCopy(locale: CheckoutLocale) {
  return CHECKOUT_COPY[locale];
}

export function checkoutPresentation(checkout: CheckoutPresentation['stripeCheckout'] | CheckoutPresentation['pixCheckout']): CheckoutPresentation {
  return checkout?.kind === 'pix_qr_code'
    ? { stripeCheckout: null, pixCheckout: checkout }
    : { stripeCheckout: checkout, pixCheckout: null };
}
