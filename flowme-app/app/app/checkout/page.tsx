'use client';

import * as React from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PixIcon from '@mui/icons-material/Pix';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { loadStripe } from '@stripe/stripe-js';
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { checkoutCopy, checkoutLocaleFromUiLanguage, checkoutPresentation, type CheckoutLocale } from '@/lib/billing/checkout-ui';

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
type StripeCheckout = { kind: 'stripe_elements'; clientSecret: string };
type PixCheckout = { kind: 'pix_qr_code'; qrCodeBase64: string; copyPasteCode: string; expiresAt: string };

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function StripePaymentForm({ returnUrl, locale }: { returnUrl: string; locale: CheckoutLocale }) {
  const checkoutState = useCheckoutElements();
  const copy = checkoutCopy(locale);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async (expressEvent?: StripeExpressCheckoutElementConfirmEvent) => {
    if (checkoutState.type !== 'success') return;
    setSubmitting(true);
    setError(null);
    const result = await checkoutState.checkout.confirm({
      returnUrl,
      ...(expressEvent ? { expressCheckoutConfirmEvent: expressEvent } : {}),
    });
    if (result.type === 'error') {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (checkoutState.type === 'loading') return <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (checkoutState.type === 'error') return <Alert severity="error">{checkoutState.error.message}</Alert>;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>{copy.quickPayment}</Typography>
        <ExpressCheckoutElement onConfirm={event => void confirm(event)} />
      </Box>
      <Divider><Typography variant="caption" color="text.secondary">{copy.cardDivider}</Typography></Divider>
      <PaymentElement options={{ layout: 'accordion' }} />
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" size="large" disabled={submitting} onClick={() => void confirm()} sx={{ minHeight: 52, fontWeight: 800 }}>
        {submitting ? <CircularProgress size={22} color="inherit" /> : copy.subscribe}
      </Button>
    </Stack>
  );
}

function CheckoutPageContent() {
  const params = useSearchParams();
  const [locale, setLocale] = React.useState<CheckoutLocale | null>(null);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [interval, setInterval] = React.useState<Interval>(params.get('interval') === 'monthly' ? 'monthly' : 'annual');
  const [method, setMethod] = React.useState<Method>('pix');
  const [name, setName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [stripeCheckout, setStripeCheckout] = React.useState<StripeCheckout | null>(null);
  const [pixCheckout, setPixCheckout] = React.useState<PixCheckout | null>(null);
  const [paid, setPaid] = React.useState(false);

  React.useEffect(() => {
    const updateLocale = () => setLocale(checkoutLocaleFromUiLanguage(localStorage.getItem('ui_language')));
    updateLocale();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ui_language') updateLocale();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    if (!attemptId || !pixCheckout || paid) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/billing/checkout/${attemptId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (payload.checkout?.status === 'paid') {
        setPaid(true);
        window.clearInterval(timer);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [attemptId, paid, pixCheckout]);

  const startCheckout = async (selectedMethod: Method = method) => {
    if (!locale) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_code: 'pro',
          interval,
          locale,
          payment_method: selectedMethod,
          ...(selectedMethod === 'pix' ? { customer_name: name, cpf_cnpj: taxId } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || checkoutCopy(locale).paymentStartError);
      setAttemptId(payload.attempt_id);
      const presentation = checkoutPresentation(payload.checkout);
      setStripeCheckout(presentation.stripeCheckout);
      setPixCheckout(presentation.pixCheckout);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : checkoutCopy(locale).paymentStartError);
    } finally {
      setLoading(false);
    }
  };

  const selectPaymentMethod = (value: Method | null) => {
    if (!value || loading || value === method) return;
    setMethod(value);
    setError(null);
    setAttemptId(null);
    setStripeCheckout(null);
    setPixCheckout(null);
    setPaid(false);
    if (value === 'card') void startCheckout('card');
  };

  if (!locale || !plan) return <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}</Box>;
  const copy = checkoutCopy(locale);
  const selectedPrice = plan.prices.find(price => price.interval === interval);
  const monthlyEquivalent = interval === 'annual' && selectedPrice ? Math.round(selectedPrice.amount_cents / 12) : selectedPrice?.amount_cents || 0;

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 6 }, background: 'radial-gradient(circle at 15% 10%, rgba(99,102,241,.18), transparent 30%), radial-gradient(circle at 85% 85%, rgba(34,197,94,.10), transparent 28%)' }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Image src="/brand/flowme-logo-transparent.png" alt="Flow Me" width={174} height={58} style={{ objectFit: 'contain' }} priority />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.05fr) minmax(380px,.95fr)' }, gap: 3, alignItems: 'start' }}>
          <Paper sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, border: '1px solid rgba(99,102,241,.35)', background: 'linear-gradient(145deg, rgba(30,31,48,.98), rgba(18,19,31,.98))', boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
            <Chip icon={<AutoAwesomeIcon />} label={plan.checkout_badge || 'Flow Me Pro'} color="primary" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: '2.2rem', sm: '3rem' }, lineHeight: 1.05 }}>{plan.short_description}</Typography>
            <Typography color="text.secondary" sx={{ mt: 2, fontSize: '1.05rem' }}>{plan.description}</Typography>
            <Stack spacing={1.4} sx={{ my: 3.5 }}>
              {plan.feature_highlights.map(feature => <Box key={feature} sx={{ display: 'flex', gap: 1.2, alignItems: 'center' }}><CheckCircleRoundedIcon color="success" /><Typography>{feature}</Typography></Box>)}
            </Stack>
            <ToggleButtonGroup value={interval} exclusive fullWidth disabled={loading || Boolean(attemptId)} onChange={(_, value: Interval | null) => value && setInterval(value)} sx={{ mb: 3 }}>
              <ToggleButton value="monthly" sx={{ minHeight: 54 }}>{copy.monthly}</ToggleButton>
              <ToggleButton value="annual" sx={{ minHeight: 54 }}><Stack direction="row" spacing={1} alignItems="center"><span>{copy.annual}</span><Chip size="small" color="success" label={`-${plan.annual_savings.percent}%`} /></Stack></ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h3" fontWeight={900}>{money(monthlyEquivalent, locale)}</Typography><Typography color="text.secondary">{copy.perMonth}</Typography>
            </Box>
            {interval === 'annual' && selectedPrice && <Typography color="success.light" fontWeight={700}>{copy.save} {money(plan.annual_savings.amountCents, locale)} · {money(selectedPrice.amount_cents, locale)} {copy.perYear}</Typography>}
          </Paper>

          <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 4, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
            {paid ? <Stack alignItems="center" spacing={2} sx={{ py: 5, textAlign: 'center' }}><CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} /><Typography variant="h4" fontWeight={900}>{copy.confirmed}</Typography><Typography color="text.secondary">{copy.released}</Typography><Button href="/app" variant="contained">{copy.enterApp}</Button></Stack>
              : pixCheckout ? <Stack spacing={2.5} alignItems="center"><Typography variant="h5" fontWeight={900}>{copy.pixHeading}</Typography><Box component="img" src={`data:image/png;base64,${pixCheckout.qrCodeBase64}`} alt="QR Code Pix" sx={{ width: 240, maxWidth: '100%', borderRadius: 2, bgcolor: 'white', p: 1 }} /><TextField value={pixCheckout.copyPasteCode} fullWidth multiline maxRows={3} InputProps={{ readOnly: true }} /><Button startIcon={<ContentCopyRoundedIcon />} onClick={() => void navigator.clipboard.writeText(pixCheckout.copyPasteCode)}>{copy.copyPix}</Button><Alert severity="info">{copy.pixConfirmation}</Alert></Stack>
              : stripeCheckout ? <CheckoutElementsProvider key={stripeCheckout.clientSecret} stripe={stripePromise} options={{ clientSecret: stripeCheckout.clientSecret, elementsOptions: { appearance: { theme: 'night', variables: { colorPrimary: '#818cf8', borderRadius: '10px' } } } }}><StripePaymentForm locale={locale} returnUrl={`${window.location.origin}/app/checkout/return?attempt_id=${attemptId}`} /></CheckoutElementsProvider>
              : <Stack spacing={2.5}>
                <Box><Typography variant="h5" fontWeight={900}>{copy.headline}</Typography><Typography color="text.secondary">{copy.paymentPrompt}</Typography></Box>
                <ToggleButtonGroup value={method} exclusive fullWidth disabled={loading} onChange={(_, value: Method | null) => selectPaymentMethod(value)} sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid !important', borderColor: 'divider !important', borderRadius: '12px !important', minHeight: 74 } }}>
                  <ToggleButton value="pix"><Stack direction="row" spacing={1} alignItems="center"><PixIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.pixTitle}</Typography><Typography variant="caption">{copy.pixDetail}</Typography></Box></Stack></ToggleButton>
                  <ToggleButton value="card"><Stack direction="row" spacing={1} alignItems="center"><CreditCardRoundedIcon /><Box textAlign="left"><Typography fontWeight={800}>{copy.cardTitle}</Typography><Typography variant="caption">{copy.cardDetail}</Typography></Box></Stack></ToggleButton>
                </ToggleButtonGroup>
                {method === 'pix' && <Stack spacing={2}><TextField label={copy.fullName} value={name} onChange={event => setName(event.target.value)} fullWidth /><TextField label={copy.taxId} value={taxId} onChange={event => setTaxId(event.target.value)} fullWidth helperText={copy.taxIdHelp} /></Stack>}
                {error && <Alert severity="error">{error}</Alert>}
                <Button variant="contained" size="large" disabled={loading || !selectedPrice || (method === 'pix' && (!name.trim() || !taxId.trim()))} onClick={() => void startCheckout(method)} sx={{ minHeight: 54, fontWeight: 900, fontSize: '1rem' }}>{loading ? <CircularProgress size={22} color="inherit" /> : method === 'card' ? copy.loadPayment : plan.checkout_cta}</Button>
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center"><LockRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} /><Typography variant="caption" color="text.secondary">{copy.protectedPayment}</Typography></Stack>
              </Stack>}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

export default function CheckoutPage() {
  return <React.Suspense fallback={<Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><CheckoutPageContent /></React.Suspense>;
}
