export type CheckoutPresentation = {
  stripeCheckout: { kind: 'stripe_elements'; clientSecret: string } | null;
  pixCheckout: { kind: 'pix_qr_code'; qrCodeBase64: string; copyPasteCode: string; expiresAt: string } | null;
};

export const PAYMENT_METHOD_COPY = {
  pix: { title: 'Pix', detail: 'QR Code · aprovação rápida' },
  card: { title: 'Cartão', detail: 'Cartão · Apple Pay · Google Pay' },
} as const;

export function checkoutPresentation(checkout: CheckoutPresentation['stripeCheckout'] | CheckoutPresentation['pixCheckout']): CheckoutPresentation {
  return checkout?.kind === 'pix_qr_code'
    ? { stripeCheckout: null, pixCheckout: checkout }
    : { stripeCheckout: checkout, pixCheckout: null };
}
