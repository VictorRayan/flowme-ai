export type CheckoutLocale = 'pt-BR' | 'en-US';
export type CheckoutInterval = 'monthly' | 'annual';
export const CHECKOUT_OFFER_DURATION_SECONDS = 15 * 60;

const CARD_ERROR_COPY = {
  'pt-BR': {
    incorrect_security_code: 'O código de segurança do cartão está incorreto. Confira o CVC e tente novamente.',
    card_declined: 'O cartão foi recusado. Tente outro cartão ou fale com o banco emissor.',
    expired_card: 'Este cartão está vencido. Confira a validade ou tente outro cartão.',
    invalid_card: 'Os dados do cartão são inválidos. Confira as informações e tente novamente.',
    insufficient_funds: 'O cartão não possui limite disponível para esta compra. Tente outro cartão.',
    processing_error: 'Não foi possível processar o cartão agora. Aguarde um instante e tente novamente.',
  },
  'en-US': {
    incorrect_security_code: 'The card security code is incorrect. Check the CVC and try again.',
    card_declined: 'The card was declined. Try another card or contact the issuing bank.',
    expired_card: 'This card has expired. Check the expiry date or try another card.',
    invalid_card: 'The card details are invalid. Check the information and try again.',
    insufficient_funds: 'The card does not have enough available credit for this purchase. Try another card.',
    processing_error: 'The card could not be processed right now. Wait a moment and try again.',
  },
} as const;

type CardErrorCode = keyof typeof CARD_ERROR_COPY['pt-BR'];

const CARD_ERROR_ALIASES: Record<string, CardErrorCode> = {
  incorrect_cvc: 'incorrect_security_code',
  incorrect_security_code: 'incorrect_security_code',
  card_declined: 'card_declined',
  expired_card: 'expired_card',
  incorrect_number: 'invalid_card',
  invalid_number: 'invalid_card',
  invalid_expiry_month: 'invalid_card',
  invalid_expiry_year: 'invalid_card',
  invalid_card: 'invalid_card',
  insufficient_funds: 'insufficient_funds',
  generic_decline: 'card_declined',
  do_not_honor: 'card_declined',
  processing_error: 'processing_error',
};

const CHECKOUT_COPY = {
  'pt-BR': {
    headline: 'Como você quer pagar?',
    paymentPrompt: 'Escolha uma opção segura para concluir.',
    limitedOffer: 'Oferta por tempo limitado',
    offerExpired: 'Tempo da oferta encerrado',
    pixTitle: 'Pix',
    pixDetail: 'QR Code · aprovação rápida',
    cardTitle: 'Cartão',
    cardDetail: 'Crédito ou débito',
    quickPayment: 'Pagamento rápido',
    cardDivider: 'ou pague com cartão',
    subscribe: 'Assinar Flow Me Pro',
    cardholderName: 'Nome no cartão',
    cardNumber: 'Número do cartão',
    cardExpiry: 'Validade',
    cardCvc: 'Código de segurança',
    cardReady: 'Seus dados são enviados diretamente e tokenizados pela operadora do cartão.',
    processingCard: 'Processando pagamento seguro…',
    awaitingConfirmation: 'Pagamento enviado. Aguardando confirmação…',
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
    cardLoadError: 'Não foi possível carregar os campos seguros do cartão.',
  },
  'en-US': {
    headline: 'How would you like to pay?',
    paymentPrompt: 'Choose a secure option to complete your purchase.',
    limitedOffer: 'Limited-time offer',
    offerExpired: 'Offer timer ended',
    pixTitle: 'Pix',
    pixDetail: 'QR code · fast approval',
    cardTitle: 'Card',
    cardDetail: 'Credit or debit card',
    quickPayment: 'Express payment',
    cardDivider: 'or pay by card',
    subscribe: 'Subscribe to Flow Me Pro',
    cardholderName: 'Name on card',
    cardNumber: 'Card number',
    cardExpiry: 'Expiry date',
    cardCvc: 'Security code',
    cardReady: 'Your details are sent directly to and tokenized by the card processor.',
    processingCard: 'Processing secure payment…',
    awaitingConfirmation: 'Payment submitted. Waiting for confirmation…',
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
    cardLoadError: 'Unable to load the secure card fields.',
  },
} as const;

export function checkoutLocaleFromUiLanguage(language: string | null | undefined): CheckoutLocale {
  return language === 'pt' ? 'pt-BR' : 'en-US';
}

export function checkoutCopy(locale: CheckoutLocale) {
  return CHECKOUT_COPY[locale];
}

export function checkoutPixAllowedForInterval(interval: CheckoutInterval): boolean {
  return interval === 'annual';
}

export function checkoutPixAnnualOnlyMessage(locale: CheckoutLocale): string {
  return locale === 'en-US' ? 'Pix is available only on the annual plan.' : 'Pix está disponível apenas no plano anual.';
}

export function checkoutCardErrorMessage(code: string | undefined, locale: CheckoutLocale, fallbackCode?: string): string {
  const normalizedCode = (code ? CARD_ERROR_ALIASES[code] : undefined)
    || (fallbackCode ? CARD_ERROR_ALIASES[fallbackCode] : undefined);
  return normalizedCode ? CARD_ERROR_COPY[locale][normalizedCode] : checkoutCopy(locale).paymentStartError;
}

export function checkoutOfferRemainingSeconds(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatCheckoutCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
