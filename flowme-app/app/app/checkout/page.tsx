'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PixIcon from '@mui/icons-material/Pix';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { loadStripe } from '@stripe/stripe-js';
import {
  CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe,
} from '@stripe/react-stripe-js';
import {
  CHECKOUT_OFFER_DURATION_SECONDS,
  checkoutCardErrorMessage,
  checkoutCopy,
  checkoutLocaleFromUiLanguage,
  checkoutOfferRemainingSeconds,
  checkoutPixAllowedForInterval,
  checkoutPixAnnualOnlyMessage,
  formatCheckoutCountdown,
  type CheckoutLocale,
} from '@/lib/billing/checkout-ui';

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
type CheckoutResponse = { attempt_id: string; checkout: PixCheckout | CardCheckout };

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

const CHECKOUT_OFFER_EXPIRY_KEY = 'flowme_checkout_offer_expires_at';

const cardElementOptions = {
  style: {
    base: { color: '#f1f5f9', iconColor: '#a5b4fc', fontSize: '16px', fontFamily: 'Inter, system-ui, sans-serif', '::placeholder': { color: '#78859b' } },
    invalid: { color: '#fca5a5' },
  },
};

const cardNumberElementOptions = {
  ...cardElementOptions,
  showIcon: true,
  iconStyle: 'solid' as const,
  disableLink: false,
};

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function localizeFeatureHighlight(feature: string, locale: CheckoutLocale) {
  return locale === 'pt-BR' ? feature.replace(/\bToday\b/g, 'Tarefas de Hoje') : feature;
}

function localeFromQuery(value: string | null): CheckoutLocale | null {
  if (value === 'pt-BR' || value === 'en-US') return value;
  return null;
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
  await fetch('/api/marketing/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-FlowMe-CSRF': csrfPayload.token },
    body: JSON.stringify({
      surface: 'checkout',
      locale,
      path: window.location.pathname,
      source: source || 'checkout_direct',
      visitor_id: trackingId(localStorage, 'flowme_lp_visitor_id'),
      session_id: trackingId(sessionStorage, 'flowme_lp_session_id'),
      referrer: document.referrer || '',
      utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
      utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
      utm_content: new URLSearchParams(window.location.search).get('utm_content') || '',
      metadata: { route: 'checkout' },
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
}: {
  locale: CheckoutLocale;
  disabled: boolean;
  createCheckout: (paymentMethodId: string) => Promise<CheckoutResponse>;
  onPending: (attemptId: string) => void;
}) {
  const copy = checkoutCopy(locale);
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [pending, setPending] = React.useState(false);
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
        if (confirmation.error) {
          throw new Error(checkoutCardErrorMessage(confirmation.error.decline_code, locale, confirmation.error.code));
        }
      }
      setPending(true);
      onPending(response.attempt_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.paymentStartError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.2} data-testid="card-payment-panel" data-clarity-mask="True">
      <TextField label={copy.cardholderName} value={cardholderName} onChange={event => setCardholderName(event.target.value)} fullWidth disabled={submitting || disabled} />
      <CardField label={copy.cardNumber}><CardNumberElement options={cardNumberElementOptions} /></CardField>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <CardField label={copy.cardExpiry}><CardExpiryElement options={cardElementOptions} /></CardField>
        <CardField label={copy.cardCvc}><CardCvcElement options={cardElementOptions} /></CardField>
      </Box>
      <Typography variant="caption" color="text.secondary">{copy.cardReady}</Typography>
      {pending && <Alert severity="info">{copy.awaitingConfirmation}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" color="success" size="large" disabled={disabled || submitting || pending || !stripe || !cardholderName.trim()} onClick={() => void submit()} sx={{ minHeight: 54, fontWeight: 900 }}>
        {submitting ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />{copy.processingCard}</> : copy.subscribe}
      </Button>
    </Stack>
  );
}

function CheckoutPageContent() {
  const params = useSearchParams();
  const [locale, setLocale] = React.useState<CheckoutLocale | null>(null);
  const [pixAvailable, setPixAvailable] = React.useState(false);
  const [marketLoaded, setMarketLoaded] = React.useState(false);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [interval, setInterval] = React.useState<Interval>(params.get('interval') === 'monthly' ? 'monthly' : 'annual');
  const [method, setMethod] = React.useState<Method>('card');
  const [name, setName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [loadingPix, setLoadingPix] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pixCheckout, setPixCheckout] = React.useState<PixCheckout | null>(null);
  const [pendingAttempts, setPendingAttempts] = React.useState<string[]>([]);
  const [paid, setPaid] = React.useState(false);
  const [offerRemainingSeconds, setOfferRemainingSeconds] = React.useState(CHECKOUT_OFFER_DURATION_SECONDS);

  React.useEffect(() => {
    const storedExpiry = Number(sessionStorage.getItem(CHECKOUT_OFFER_EXPIRY_KEY));
    const expiresAt = Number.isFinite(storedExpiry) && storedExpiry > 0
      ? storedExpiry
      : Date.now() + CHECKOUT_OFFER_DURATION_SECONDS * 1000;
    sessionStorage.setItem(CHECKOUT_OFFER_EXPIRY_KEY, String(expiresAt));
    const updateCountdown = () => setOfferRemainingSeconds(checkoutOfferRemainingSeconds(expiresAt, Date.now()));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const updateLocale = () => setLocale(checkoutLocaleFromUiLanguage(localStorage.getItem('ui_language')));
    const queryLocale = localeFromQuery(params.get('locale'));
    if (queryLocale) {
      setLocale(queryLocale);
      return;
    }
    updateLocale();
    const onStorage = (event: StorageEvent) => { if (event.key === 'ui_language') updateLocale(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [params]);

  React.useEffect(() => {
    if (!locale) return;
    const key = `flowme_checkout_visit_${locale}_${params.get('source') || 'direct'}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordCheckoutVisit(locale, params.get('source')).catch(() => {});
  }, [locale, params]);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/billing/market', { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(payload => setPixAvailable(Boolean(payload.pixAvailable)))
      .catch(() => setPixAvailable(false))
      .finally(() => setMarketLoaded(true));
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!locale) return;
    const controller = new AbortController();
    fetch(`/api/billing/catalog?locale=${encodeURIComponent(locale)}`, { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(payload => {
        const pro = (payload.plans || []).find((item: Plan) => item.code === 'pro');
        if (!pro) throw new Error(checkoutCopy(locale).unavailablePlan);
        setPlan(pro);
      })
      .catch(loadError => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : checkoutCopy(locale).checkoutLoadError);
      });
    return () => controller.abort();
  }, [locale]);

  React.useEffect(() => {
    if (pendingAttempts.length === 0 || paid) return;
    const poll = async () => {
      for (const attemptId of pendingAttempts) {
        const response = await fetch(`/api/billing/checkout/${attemptId}`, { cache: 'no-store' });
        const payload = await response.json();
        if (payload.checkout?.status === 'paid') {
          setPaid(true);
          return;
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(timer);
  }, [paid, pendingAttempts]);

  const canUsePix = pixAvailable && checkoutPixAllowedForInterval(interval);

  React.useEffect(() => {
    if (canUsePix || method !== 'pix') return;
    setMethod('card');
    setPixCheckout(null);
  }, [canUsePix, method]);

  const requestCheckout = async (selectedMethod: Method, paymentMethodId?: string): Promise<CheckoutResponse> => {
    if (!locale) throw new Error('Checkout locale unavailable');
    if (selectedMethod === 'pix' && !checkoutPixAllowedForInterval(interval)) {
      throw new Error(checkoutPixAnnualOnlyMessage(locale));
    }
    setError(null);
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_code: 'pro', interval, locale, payment_method: selectedMethod,
        source: params.get('source') || undefined,
        ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
        ...(selectedMethod === 'pix' ? { customer_name: name, cpf_cnpj: taxId } : {}),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message || checkoutCopy(locale).paymentStartError);
    return payload as CheckoutResponse;
  };

  const startPix = async () => {
    setLoadingPix(true);
    try {
      const response = await requestCheckout('pix');
      if (response.checkout.kind !== 'pix_qr_code') throw new Error(checkoutCopy(locale!).paymentStartError);
      setPixCheckout(response.checkout);
      setPendingAttempts(current => [...new Set([...current, response.attempt_id])]);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : checkoutCopy(locale!).paymentStartError);
    } finally {
      setLoadingPix(false);
    }
  };

  if (!locale || !plan || !marketLoaded) return <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}</Box>;
  const copy = checkoutCopy(locale);
  const selectedPrice = plan.prices.find(price => price.interval === interval);
  const monthlyEquivalent = interval === 'annual' && selectedPrice ? Math.round(selectedPrice.amount_cents / 12) : selectedPrice?.amount_cents || 0;
  const hasPending = pendingAttempts.length > 0;

  return (
    <Box data-testid="checkout-scroll" sx={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', background: 'radial-gradient(circle at 15% 10%, rgba(99,102,241,.18), transparent 30%), radial-gradient(circle at 85% 85%, rgba(34,197,94,.10), transparent 28%)' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, lg: 6 }, pb: { xs: 'calc(40px + env(safe-area-inset-bottom))', lg: 6 } }}>
        {!paid && <Box data-testid="checkout-offer-countdown" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, minHeight: 68, px: { xs: 2, sm: 3 }, py: 1.5, mb: 3, borderRadius: 3, color: '#fff', background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 10px 28px rgba(234,88,12,.24)' }}>
          <AccessTimeRoundedIcon aria-hidden="true" sx={{ fontSize: 24, opacity: 0.9 }} />
          <Typography component="span" role="timer" aria-label={`${copy.limitedOffer}: ${formatCheckoutCountdown(offerRemainingSeconds)}`} fontWeight={950} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{formatCheckoutCountdown(offerRemainingSeconds)}</Typography>
          <Typography component="span" fontWeight={800} sx={{ fontSize: { xs: '.88rem', sm: '1rem' }, lineHeight: 1.2 }}>{offerRemainingSeconds > 0 ? copy.limitedOffer : copy.offerExpired}</Typography>
        </Box>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.05fr) minmax(380px,.95fr)' }, gap: 3, alignItems: 'start' }}>
          <Paper sx={{ p: { xs: 2.5, sm: 4 }, minWidth: 0, borderRadius: 4, border: '1px solid rgba(99,102,241,.35)', background: 'linear-gradient(145deg, rgba(30,31,48,.98), rgba(18,19,31,.98))', boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
            <Chip icon={<AutoAwesomeIcon />} label={plan.checkout_badge || 'Flow Me Pro'} color="primary" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={900} sx={{ overflowWrap: 'anywhere', fontSize: { xs: '2.1rem', sm: '2.7rem', lg: '3rem' }, lineHeight: 1.05 }}>{plan.short_description}</Typography>
            <Typography color="text.secondary" sx={{ mt: 2, fontSize: { xs: '1rem', sm: '1.05rem' } }}>{plan.description}</Typography>
            <Stack spacing={1.4} sx={{ my: 3.5 }}>
              {plan.feature_highlights.map(feature => <Box key={feature} sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}><CheckCircleRoundedIcon color="success" sx={{ mt: 0.2, flexShrink: 0 }} /><Typography>{localizeFeatureHighlight(feature, locale)}</Typography></Box>)}
            </Stack>
            <ToggleButtonGroup value={interval} exclusive fullWidth disabled={hasPending} onChange={(_, value: Interval | null) => value && setInterval(value)} sx={{ mb: 3 }}>
              <ToggleButton value="monthly" sx={{ minHeight: 54 }}>{copy.monthly}</ToggleButton>
              <ToggleButton value="annual" sx={{ minHeight: 54 }}><Stack direction="row" spacing={1} alignItems="center"><span>{copy.annual}</span><Chip size="small" color="success" label={`-${plan.annual_savings.percent}%`} /></Stack></ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: '2.5rem', sm: '3rem' } }}>{money(monthlyEquivalent, locale)}</Typography><Typography color="text.secondary">{copy.perMonth}</Typography>
            </Box>
            {interval === 'annual' && selectedPrice && <Typography color="success.light" fontWeight={700}>{copy.save} {money(plan.annual_savings.amountCents, locale)} · {money(selectedPrice.amount_cents, locale)} {copy.perYear}</Typography>}
          </Paper>

          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, minWidth: 0, borderRadius: 4, boxShadow: '0 24px 80px rgba(0,0,0,.3)', position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <Stack spacing={2.5}>
              <Box><Typography variant="h5" fontWeight={900}>{copy.headline}</Typography><Typography color="text.secondary">{copy.paymentPrompt}</Typography></Box>
              <ToggleButtonGroup aria-label={copy.headline} value={method} exclusive fullWidth disabled={loadingPix} onChange={(_, value: Method | null) => value && setMethod(value)} sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid !important', borderColor: 'divider !important', borderRadius: '12px !important', minHeight: 74 } }}>
                {canUsePix && <ToggleButton value="pix"><Stack direction="row" spacing={1} alignItems="center"><PixIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.pixTitle}</Typography><Typography variant="caption">{copy.pixDetail}</Typography></Box></Stack></ToggleButton>}
                <ToggleButton value="card"><Stack direction="row" spacing={1} alignItems="center"><CreditCardRoundedIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.cardTitle}</Typography><Typography variant="caption">{copy.cardDetail}</Typography></Box></Stack></ToggleButton>
              </ToggleButtonGroup>

              {paid && <Stack alignItems="center" spacing={2} sx={{ py: 4, textAlign: 'center' }}><CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} /><Typography variant="h4" fontWeight={900}>{copy.confirmed}</Typography><Typography color="text.secondary">{copy.released}</Typography><Button href="/app?billing=success" variant="contained">{copy.enterApp}</Button></Stack>}

              <Box sx={{ display: paid || method !== 'card' ? 'none' : 'block' }}>
                <Elements stripe={stripePromise} options={{ locale: locale === 'pt-BR' ? 'pt-BR' : 'en' }}>
                  <CardPaymentForm locale={locale} disabled={!selectedPrice} createCheckout={paymentMethodId => requestCheckout('card', paymentMethodId)} onPending={attemptId => setPendingAttempts(current => [...new Set([...current, attemptId])])} />
                </Elements>
              </Box>

              {!paid && method === 'pix' && canUsePix && (pixCheckout
                ? <Stack spacing={2.5} alignItems="center" data-clarity-mask="True"><Typography variant="h5" fontWeight={900}>{copy.pixHeading}</Typography><Box component="img" src={`data:image/png;base64,${pixCheckout.qrCodeBase64}`} alt="QR Code Pix" sx={{ width: 240, maxWidth: '100%', borderRadius: 2, bgcolor: 'white', p: 1 }} /><TextField value={pixCheckout.copyPasteCode} fullWidth multiline maxRows={3} InputProps={{ readOnly: true }} /><Button startIcon={<ContentCopyRoundedIcon />} onClick={() => void navigator.clipboard.writeText(pixCheckout.copyPasteCode)}>{copy.copyPix}</Button><Alert severity="info">{copy.pixConfirmation}</Alert></Stack>
                : <Stack spacing={2} data-clarity-mask="True"><TextField label={copy.fullName} value={name} onChange={event => setName(event.target.value)} fullWidth /><TextField label={copy.taxId} value={taxId} onChange={event => setTaxId(event.target.value)} fullWidth helperText={copy.taxIdHelp} />{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" size="large" disabled={loadingPix || !selectedPrice || !name.trim() || !taxId.trim()} onClick={() => void startPix()} sx={{ minHeight: 54, fontWeight: 900 }}>{loadingPix ? <CircularProgress size={22} color="inherit" /> : plan.checkout_cta}</Button></Stack>)}

              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center"><LockRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} /><Typography variant="caption" color="text.secondary">{copy.protectedPayment}</Typography></Stack>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

export default function CheckoutPage() {
  return <React.Suspense fallback={<Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><CheckoutPageContent /></React.Suspense>;
}
