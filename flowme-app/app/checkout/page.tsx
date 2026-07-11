'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PixIcon from '@mui/icons-material/Pix';
import { loadStripe } from '@stripe/stripe-js';
import {
  CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe,
} from '@stripe/react-stripe-js';
import {
  CHECKOUT_OFFER_DURATION_SECONDS,
  checkoutCardErrorMessage,
  checkoutCopy,
  checkoutOfferRemainingSeconds,
  checkoutPixAllowedForInterval,
  checkoutPixAnnualOnlyMessage,
  formatCheckoutCountdown,
  type CheckoutLocale,
} from '@/lib/billing/checkout-ui';
import { fbq, generateEventId, readCookie, writeCookie, fbcFromFbclid } from '@/lib/meta/pixel';

type Interval = 'monthly' | 'annual';
type Method = 'pix' | 'card';
type Plan = {
  code: string;
  name: string;
  short_description: string;
  description: string;
  checkout_badge: string | null;
  checkout_cta: string;
  feature_highlights: string[];
  prices: Array<{ interval: Interval; currency: string; amount_cents: number }>;
  annual_savings: { amountCents: number; percent: number };
};
type PixCheckout = { kind: 'pix_qr_code'; qrCodeBase64: string; copyPasteCode: string; expiresAt: string };
type CardCheckout = { kind: 'stripe_card_subscription'; confirmationClientSecret: string | null };
type CheckoutResponse = { attempt_id: string; public_checkout_token: string; email: string; checkout: PixCheckout | CardCheckout };

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);
const CHECKOUT_OFFER_EXPIRY_KEY = 'flowme_public_checkout_offer_expires_at';

const cardElementOptions = {
  style: {
    base: { color: '#f1f5f9', iconColor: '#a5b4fc', fontSize: '16px', fontFamily: 'Inter, system-ui, sans-serif', '::placeholder': { color: '#78859b' } },
    invalid: { color: '#fca5a5' },
  },
};
const cardNumberElementOptions = { ...cardElementOptions, showIcon: true, iconStyle: 'solid' as const, disableLink: false };

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function localeFromQuery(value: string | null): CheckoutLocale {
  return value === 'en-US' ? 'en-US' : 'pt-BR';
}

function queryText(value: string | null, limit: number) {
  return value ? value.trim().slice(0, limit) : '';
}

function trackingId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

async function recordCheckoutVisit(locale: CheckoutLocale, source: string | null) {
  const csrfResponse = await fetch('/api/marketing/csrf', { cache: 'no-store' });
  const csrfPayload = await csrfResponse.json();
  if (!csrfResponse.ok || !csrfPayload.ok) return;
  const params = new URLSearchParams(window.location.search);
  await fetch('/api/marketing/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-FlowMe-CSRF': csrfPayload.token },
    body: JSON.stringify({
      surface: 'checkout',
      locale,
      path: window.location.pathname,
      source: source || 'public_checkout',
      visitor_id: trackingId(localStorage, 'flowme_lp_visitor_id'),
      session_id: trackingId(sessionStorage, 'flowme_lp_session_id'),
      referrer: document.referrer || '',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      metadata: { route: 'public_checkout' },
    }),
  });
}

function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="label" variant="body2" fontWeight={700} sx={{ display: 'block', mb: 0.8 }}>{label}</Typography>
      <Box sx={{ minHeight: 50, px: 1.8, py: 1.65, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(9,12,20,.38)', '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 1px rgba(99,102,241,.55)' } }}>
        {children}
      </Box>
    </Box>
  );
}

function CardPaymentForm({
  locale,
  disabled,
  createCheckout,
  onPending,
  initialName,
}: {
  locale: CheckoutLocale;
  disabled: boolean;
  createCheckout: (paymentMethodId: string) => Promise<CheckoutResponse>;
  onPending: (token: string, email: string) => void;
  initialName: string;
}) {
  const copy = checkoutCopy(locale);
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = React.useState(initialName);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const cardNumber = elements?.getElement(CardNumberElement);
    if (!stripe || !cardNumber || !cardholderName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const paymentMethod = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: { name: cardholderName.trim() },
      });
      if (paymentMethod.error || !paymentMethod.paymentMethod) {
        throw new Error(checkoutCardErrorMessage(paymentMethod.error?.decline_code, locale, paymentMethod.error?.code));
      }
      const response = await createCheckout(paymentMethod.paymentMethod.id);
      if (response.checkout.kind !== 'stripe_card_subscription') throw new Error(copy.paymentStartError);
      if (response.checkout.confirmationClientSecret) {
        const confirmation = await stripe.confirmCardPayment(response.checkout.confirmationClientSecret);
        if (confirmation.error) throw new Error(checkoutCardErrorMessage(confirmation.error.decline_code, locale, confirmation.error.code));
      }
      onPending(response.public_checkout_token, response.email);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.paymentStartError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.2}>
      <TextField label={copy.cardholderName} value={cardholderName} onChange={event => setCardholderName(event.target.value)} fullWidth disabled={submitting || disabled} />
      <CardField label={copy.cardNumber}><CardNumberElement options={cardNumberElementOptions} /></CardField>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <CardField label={copy.cardExpiry}><CardExpiryElement options={cardElementOptions} /></CardField>
        <CardField label={copy.cardCvc}><CardCvcElement options={cardElementOptions} /></CardField>
      </Box>
      <Typography variant="caption" color="text.secondary">{copy.cardReady}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" color="success" size="large" disabled={disabled || submitting || !stripe || !cardholderName.trim()} onClick={() => void submit()} sx={{ minHeight: 54, fontWeight: 900 }}>
        {submitting ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />{copy.processingCard}</> : copy.subscribe}
      </Button>
    </Stack>
  );
}

function PublicCheckoutContent() {
  const params = useSearchParams();
  const locale = localeFromQuery(params.get('locale'));
  const copy = checkoutCopy(locale);
  const leadToken = params.get('lead_token') || '';
  const capturedName = queryText(params.get('name'), 160);
  const displayEmail = queryText(params.get('email'), 240);
  const capturedPhone = queryText(params.get('phone'), 40);
  const forwardedExternalId = queryText(params.get('external_id'), 160);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [pixAvailable, setPixAvailable] = React.useState(false);
  const [marketLoaded, setMarketLoaded] = React.useState(false);
  const [interval, setInterval] = React.useState<Interval>(params.get('interval') === 'monthly' ? 'monthly' : 'annual');
  const [method, setMethod] = React.useState<Method>('card');
  const [name, setName] = React.useState(capturedName);
  const [taxId, setTaxId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loadingPix, setLoadingPix] = React.useState(false);
  const [pixCheckout, setPixCheckout] = React.useState<PixCheckout | null>(null);
  const [publicToken, setPublicToken] = React.useState(params.get('token') || '');
  const [verifiedEmail, setVerifiedEmail] = React.useState(displayEmail);
  const [paid, setPaid] = React.useState(false);
  const [attemptId, setAttemptId] = React.useState('');
  const [offerRemainingSeconds, setOfferRemainingSeconds] = React.useState(CHECKOUT_OFFER_DURATION_SECONDS);

  // ── Meta Pixel tracking params forwarded from the LP via URL ──────────────
  // The LP sets _fbp and _fbc on the redirect URL so the Pixel on this domain
  // uses the same visitor identity, enabling cross-domain purchase attribution.
  const urlFbp = params.get('_fbp') || '';
  const rawFbclid = params.get('fbclid') || params.get('_fbclid') || '';
  const urlFbc = params.get('_fbc') || (rawFbclid ? fbcFromFbclid(rawFbclid) : '');
  const externalId = React.useMemo(() => {
    if (typeof window === 'undefined') return forwardedExternalId;
    if (forwardedExternalId) {
      window.localStorage.setItem('flowme_meta_external_id', forwardedExternalId);
      return forwardedExternalId;
    }
    return trackingId(window.localStorage, 'flowme_meta_external_id');
  }, [forwardedExternalId]);

  React.useEffect(() => {
    const storedExpiry = Number(sessionStorage.getItem(CHECKOUT_OFFER_EXPIRY_KEY));
    const expiresAt = Number.isFinite(storedExpiry) && storedExpiry > 0 ? storedExpiry : Date.now() + CHECKOUT_OFFER_DURATION_SECONDS * 1000;
    sessionStorage.setItem(CHECKOUT_OFFER_EXPIRY_KEY, String(expiresAt));
    const updateCountdown = () => setOfferRemainingSeconds(checkoutOfferRemainingSeconds(expiresAt, Date.now()));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const key = `flowme_public_checkout_visit_${locale}_${params.get('source') || 'direct'}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordCheckoutVisit(locale, params.get('source')).catch(() => {});
  }, [locale, params]);

  // ── Meta Pixel: InitiateCheckout (fires once when page mounts) ────────────
  // Cross-domain identity preservation:
  //   The LP (flow-me.online) passes _fbp and _fbc as URL params.
  //   We WRITE those values as first-party cookies on .flow-me.online BEFORE
  //   fbq('init') runs, so the Pixel reads the same identity it set on the LP.
  //   Note: fbq('init') does NOT accept fbp/fbc as arguments — the Pixel only
  //   reads them from document.cookie.  Source:
  //   https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching
  React.useEffect(() => {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (!pixelId) return;

    const rootDomain = window.location.hostname.endsWith('flow-me.online') ? '.flow-me.online' : undefined;
    if (urlFbp && readCookie('_fbp') !== urlFbp) writeCookie('_fbp', urlFbp, rootDomain);
    if (urlFbc && readCookie('_fbc') !== urlFbc) writeCookie('_fbc', urlFbc, rootDomain);

    // Now init — Pixel reads _fbp/_fbc from document.cookie automatically.
    const eventId = generateEventId('checkout');
    fbq('init', pixelId, { external_id: externalId });
    fbq('track', 'PageView');
    fbq('track', 'InitiateCheckout', {
      content_name: 'Flow Me Pro',
      currency: 'BRL',
      content_category: 'Subscription',
    }, { eventID: eventId });
    fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'InitiateCheckout',
        event_id: eventId,
        event_source_url: window.location.href,
        external_id: externalId || undefined,
        name: capturedName || undefined,
        email: displayEmail || undefined,
        phone: capturedPhone || undefined,
        fbp: urlFbp || readCookie('_fbp') || undefined,
        fbc: urlFbc || readCookie('_fbc') || undefined,
      }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  React.useEffect(() => {
    fetch('/api/billing/market', { cache: 'no-store' })
      .then(response => response.json())
      .then(payload => setPixAvailable(Boolean(payload.pixAvailable)))
      .catch(() => setPixAvailable(false))
      .finally(() => setMarketLoaded(true));
  }, []);

  React.useEffect(() => {
    fetch(`/api/billing/catalog?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(payload => {
        const pro = (payload.plans || []).find((item: Plan) => item.code === 'pro');
        if (!pro) throw new Error(copy.unavailablePlan);
        setPlan(pro);
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : copy.checkoutLoadError));
  }, [copy.checkoutLoadError, copy.unavailablePlan, locale]);

  React.useEffect(() => {
    if (!publicToken || paid) return;
    const poll = async () => {
      const response = await fetch(`/api/billing/public-checkout/status?token=${encodeURIComponent(publicToken)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (payload.checkout?.email) setVerifiedEmail(payload.checkout.email);
      if (payload.checkout?.status === 'paid' || payload.checkout?.status === 'claimed') setPaid(true);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(timer);
  }, [paid, publicToken]);

  // ── Meta Pixel: Purchase (fires when payment is confirmed) ────────────────
  // Dispatched both client-side (Pixel) and server-side (Conversions API).
  // The same event_id on both legs lets Meta deduplicate and count only once.
  React.useEffect(() => {
    if (!paid) return;
    const selectedPrice = plan?.prices.find(p => p.interval === interval);
    if (!selectedPrice) return;
    const value = selectedPrice.amount_cents / 100;
    // Deterministic id so this browser Purchase deduplicates against the
    // server-side Purchase fired from the payment webhook (same checkout session).
    const eventId = attemptId ? `purchase_${attemptId}` : generateEventId('purchase');
    const fbp = urlFbp || readCookie('_fbp');
    const fbc = urlFbc || readCookie('_fbc');

    // 1. Client-side Pixel event
    fbq('track', 'Purchase', {
      value,
      currency: 'BRL',
      content_name: 'Flow Me Pro',
      content_ids: ['flowme_pro'],
      content_type: 'product',
    }, { eventID: eventId });

    // 2. Server-side Conversions API (fire-and-forget)
    fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'Purchase',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : 'https://app.flow-me.online/checkout',
        external_id: externalId || undefined,
        name: capturedName || name || undefined,
        email: verifiedEmail || displayEmail || undefined,
        phone: capturedPhone || undefined,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
        value,
        currency: 'BRL',
      }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  const canUsePix = pixAvailable && checkoutPixAllowedForInterval(interval);

  React.useEffect(() => {
    if (canUsePix || method !== 'pix') return;
    setMethod('card');
    setPixCheckout(null);
  }, [canUsePix, method]);

  const requestCheckout = async (selectedMethod: Method, paymentMethodId?: string): Promise<CheckoutResponse> => {
    if (!leadToken) throw new Error(locale === 'en-US' ? 'Open this checkout from the Flow Me offer page.' : 'Abra este checkout pela página de oferta do Flow Me.');
    if (selectedMethod === 'pix' && !checkoutPixAllowedForInterval(interval)) {
      throw new Error(checkoutPixAnnualOnlyMessage(locale));
    }
    setError(null);
    const response = await fetch('/api/billing/public-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_token: leadToken,
        plan_code: 'pro',
        interval,
        locale,
        payment_method: selectedMethod,
        source: params.get('source') || undefined,
        meta_external_id: externalId || undefined,
        meta_fbp: (urlFbp || readCookie('_fbp')) || undefined,
        meta_fbc: (urlFbc || readCookie('_fbc')) || undefined,
        ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
        ...(selectedMethod === 'pix' ? { customer_name: name, cpf_cnpj: taxId } : {}),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message || copy.paymentStartError);
    if (payload.attempt_id) setAttemptId(String(payload.attempt_id));
    const selectedPrice = plan?.prices.find(p => p.interval === interval);
    const eventId = generateEventId('payment_info');
    fbq('track', 'AddPaymentInfo', {
      value: selectedPrice ? selectedPrice.amount_cents / 100 : undefined,
      currency: 'BRL',
      content_name: 'Flow Me Pro',
      content_category: 'Subscription',
      payment_method: selectedMethod,
    }, { eventID: eventId });
    fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'AddPaymentInfo',
        event_id: eventId,
        event_source_url: window.location.href,
        external_id: externalId || undefined,
        name: capturedName || name || undefined,
        email: verifiedEmail || displayEmail || undefined,
        phone: capturedPhone || undefined,
        fbp: urlFbp || readCookie('_fbp') || undefined,
        fbc: urlFbc || readCookie('_fbc') || undefined,
        value: selectedPrice ? selectedPrice.amount_cents / 100 : undefined,
        currency: 'BRL',
      }),
    }).catch(() => {});
    return payload as CheckoutResponse;
  };

  const startPix = async () => {
    setLoadingPix(true);
    try {
      const response = await requestCheckout('pix');
      if (response.checkout.kind !== 'pix_qr_code') throw new Error(copy.paymentStartError);
      setPixCheckout(response.checkout);
      setPublicToken(response.public_checkout_token);
      setVerifiedEmail(response.email);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : copy.paymentStartError);
    } finally {
      setLoadingPix(false);
    }
  };

  if (!plan || !marketLoaded) {
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}</Box>;
  }

  const selectedPrice = plan.prices.find(price => price.interval === interval);
  const monthlyEquivalent = interval === 'annual' && selectedPrice ? Math.round(selectedPrice.amount_cents / 12) : selectedPrice?.amount_cents || 0;
  const claimHref = `/login?claim_token=${encodeURIComponent(publicToken)}${verifiedEmail ? `&email=${encodeURIComponent(verifiedEmail)}` : ''}`;
  const contactSummary = [verifiedEmail || displayEmail, capturedPhone].filter(Boolean).join(' · ');

  return (
    <Box sx={{ minHeight: '100vh', overflowX: 'hidden', background: 'radial-gradient(circle at 15% 10%, rgba(249,115,22,.18), transparent 30%), radial-gradient(circle at 85% 85%, rgba(34,197,94,.10), transparent 28%), #0d0f14' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, lg: 6 }, pb: 6 }}>
        {!paid && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, minHeight: 68, px: { xs: 2, sm: 3 }, py: 1.5, mb: 3, borderRadius: 3, color: '#fff', background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 10px 28px rgba(234,88,12,.24)' }}>
          <AccessTimeRoundedIcon aria-hidden="true" sx={{ fontSize: 24, opacity: 0.9 }} />
          <Typography component="span" role="timer" fontWeight={950} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatCheckoutCountdown(offerRemainingSeconds)}</Typography>
          <Typography component="span" fontWeight={800}>{offerRemainingSeconds > 0 ? copy.limitedOffer : copy.offerExpired}</Typography>
        </Box>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.05fr) minmax(380px,.95fr)' }, gap: 3, alignItems: 'start' }}>
          <Paper sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, border: '1px solid rgba(249,115,22,.28)', background: 'linear-gradient(145deg, rgba(30,31,48,.98), rgba(18,19,31,.98))' }}>
            <Chip icon={<AutoAwesomeIcon />} label={plan.checkout_badge || 'Flow Me Pro'} color="primary" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: '2.1rem', sm: '2.7rem', lg: '3rem' }, lineHeight: 1.05 }}>{plan.short_description}</Typography>
            <Typography color="text.secondary" sx={{ mt: 2 }}>{plan.description}</Typography>
            <Stack spacing={1.4} sx={{ my: 3.5 }}>
              {plan.feature_highlights.map(feature => <Box key={feature} sx={{ display: 'flex', gap: 1.2 }}><CheckCircleRoundedIcon color="success" /><Typography>{locale === 'pt-BR' ? feature.replace(/\bToday\b/g, 'Tarefas de Hoje') : feature}</Typography></Box>)}
            </Stack>
            <ToggleButtonGroup value={interval} exclusive fullWidth onChange={(_, value: Interval | null) => value && setInterval(value)} sx={{ mb: 3 }}>
              <ToggleButton value="monthly" sx={{ minHeight: 54 }}>{copy.monthly}</ToggleButton>
              <ToggleButton value="annual" sx={{ minHeight: 54 }}><Stack direction="row" spacing={1} alignItems="center"><span>{copy.annual}</span><Chip size="small" color="success" label={`-${plan.annual_savings.percent}%`} /></Stack></ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h3" fontWeight={900}>{money(monthlyEquivalent, locale)}</Typography><Typography color="text.secondary">{copy.perMonth}</Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 4, position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <Stack spacing={2.5}>
              {paid ? (
                <Stack alignItems="center" spacing={2} sx={{ py: 4, textAlign: 'center' }}>
                  <CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} />
                  <Typography variant="h4" fontWeight={900}>{copy.confirmed}</Typography>
                  <Typography color="text.secondary">
                    {locale === 'en-US' ? 'Your Pro access will be released for' : 'Seu acesso Pro será liberado para'} <strong>{verifiedEmail}</strong>.
                  </Typography>
                  <Button href={claimHref} variant="contained" color="success" size="large">{locale === 'en-US' ? 'Start using Flow Me' : 'Começar a usar o Flow Me'}</Button>
                </Stack>
              ) : (
                <>
                  <Box>
                    <Typography variant="h5" fontWeight={900}>{copy.headline}</Typography>
                    <Typography color="text.secondary">{copy.paymentPrompt}</Typography>
                    {contactSummary && <Alert severity="info" sx={{ mt: 2 }}>{locale === 'en-US' ? 'Access will be released for:' : 'O acesso será liberado para:'} <strong>{contactSummary}</strong></Alert>}
                  </Box>
                  <ToggleButtonGroup value={method} exclusive fullWidth disabled={loadingPix} onChange={(_, value: Method | null) => value && setMethod(value)} sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid !important', borderColor: 'divider !important', borderRadius: '12px !important', minHeight: 74 } }}>
                    {canUsePix && <ToggleButton value="pix"><Stack direction="row" spacing={1} alignItems="center"><PixIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.pixTitle}</Typography><Typography variant="caption">{copy.pixDetail}</Typography></Box></Stack></ToggleButton>}
                    <ToggleButton value="card"><Stack direction="row" spacing={1} alignItems="center"><CreditCardRoundedIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.cardTitle}</Typography><Typography variant="caption">{copy.cardDetail}</Typography></Box></Stack></ToggleButton>
                  </ToggleButtonGroup>

                  <Box sx={{ display: method !== 'card' ? 'none' : 'block' }}>
                    <Elements stripe={stripePromise} options={{ locale: locale === 'pt-BR' ? 'pt-BR' : 'en' }}>
                      <CardPaymentForm locale={locale} disabled={!selectedPrice} initialName={capturedName} createCheckout={paymentMethodId => requestCheckout('card', paymentMethodId)} onPending={(token, email) => { setPublicToken(token); setVerifiedEmail(email); }} />
                    </Elements>
                  </Box>

                  {method === 'pix' && canUsePix && (pixCheckout
                    ? <Stack spacing={2.5} alignItems="center"><Typography variant="h5" fontWeight={900}>{copy.pixHeading}</Typography><Box component="img" src={`data:image/png;base64,${pixCheckout.qrCodeBase64}`} alt="QR Code Pix" sx={{ width: 240, maxWidth: '100%', borderRadius: 2, bgcolor: 'white', p: 1 }} /><TextField value={pixCheckout.copyPasteCode} fullWidth multiline maxRows={3} InputProps={{ readOnly: true }} /><Button startIcon={<ContentCopyRoundedIcon />} onClick={() => void navigator.clipboard.writeText(pixCheckout.copyPasteCode)}>{copy.copyPix}</Button><Alert severity="info">{copy.pixConfirmation}</Alert></Stack>
                    : <Stack spacing={2}><TextField label={copy.fullName} value={name} onChange={event => setName(event.target.value)} fullWidth /><TextField label={copy.taxId} value={taxId} onChange={event => setTaxId(event.target.value)} fullWidth helperText={copy.taxIdHelp} />{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" size="large" disabled={loadingPix || !selectedPrice || !name.trim() || !taxId.trim()} onClick={() => void startPix()} sx={{ minHeight: 54, fontWeight: 900 }}>{loadingPix ? <CircularProgress size={22} color="inherit" /> : plan.checkout_cta}</Button></Stack>)}
                  {error && method === 'card' && <Alert severity="error">{error}</Alert>}
                  <Stack direction="row" spacing={1} justifyContent="center" alignItems="center"><LockRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} /><Typography variant="caption" color="text.secondary">{copy.protectedPayment}</Typography></Stack>
                </>
              )}
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

export default function PublicCheckoutPage() {
  return <React.Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><PublicCheckoutContent /></React.Suspense>;
}
