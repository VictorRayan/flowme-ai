'use client';

import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { FeatureKey } from '@/lib/billing/entitlements';
import { getUiLang, resolveUiLang, type UiLang } from '@/lib/i18n';
import {
  PRO_PRICES,
  annualSavingsPercent,
  featureName,
  formatBrl,
  type BillingInterval,
} from '@/lib/billing/pricing';

type UpgradeDialogProps = {
  open: boolean;
  feature: FeatureKey | null;
  reason: 'feature' | 'credits' | 'general';
  onClose: () => void;
  onCheckout: (interval: BillingInterval) => Promise<void>;
};

const COPY: Record<UiLang, {
  benefits: string[];
  titleCredits: string;
  titleFeature: (feature: string) => string;
  titleGeneral: string;
  creditsBody: string;
  generalBody: string;
  billingPeriod: string;
  monthly: string;
  annual: string;
  save: string;
  perMonth: string;
  billedAnnual: (amount: string) => string;
  checkoutError: string;
  notNow: string;
  cta: string;
}> = {
  en: {
    benefits: [
      'Unlimited AI',
      'Calendar, Today, goals and finance',
      'Connectors, WhatsApp and automations',
      'Reviews, meetings and image generation',
    ],
    titleCredits: 'Continue with unlimited AI',
    titleFeature: feature => `Unlock ${feature}`,
    titleGeneral: 'Unlock all of Flow Me',
    creditsBody: 'Your AI credits for today are gone. They renew tomorrow, or you can unlock unlimited AI now.',
    generalBody: 'Everything in Flow Me and unlimited AI credits in one plan.',
    billingPeriod: 'Billing period',
    monthly: 'Monthly',
    annual: 'Annual',
    save: 'Save',
    perMonth: '/month',
    billedAnnual: amount => `${amount} billed once per year`,
    checkoutError: 'Could not open checkout.',
    notNow: 'Not now',
    cta: 'Unlock Pro',
  },
  pt: {
    benefits: [
      'IA ilimitada',
      'Calendário, Tarefas de Hoje, metas e finanças',
      'Conectores, WhatsApp e automações',
      'Revisões, reuniões e geração de imagens',
    ],
    titleCredits: 'Continue com IA ilimitada',
    titleFeature: feature => `Desbloqueie ${feature}`,
    titleGeneral: 'Desbloqueie todo o Flow Me',
    creditsBody: 'Seus créditos de hoje acabaram. Eles renovam amanhã, ou você pode liberar IA ilimitada agora.',
    generalBody: 'Tudo do Flow Me e créditos de IA ilimitados em um único plano.',
    billingPeriod: 'Período de cobrança',
    monthly: 'Mensal',
    annual: 'Anual',
    save: 'Economize',
    perMonth: '/mês',
    billedAnnual: amount => `${amount} cobrados uma vez por ano`,
    checkoutError: 'Não foi possível abrir o checkout.',
    notNow: 'Agora não',
    cta: 'Desbloquear Pro',
  },
};

export default function UpgradeDialog({ open, feature, reason, onClose, onCheckout }: UpgradeDialogProps) {
  const [interval, setInterval] = React.useState<BillingInterval>('annual');
  const [lang, setLang] = React.useState<UiLang>('en');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = PRO_PRICES[interval];
  const copy = COPY[lang];
  const lockedFeature = featureName(feature, lang);

  React.useEffect(() => {
    setLang(getUiLang());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ui_language') setLang(resolveUiLang(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCheckout(interval);
    } catch (checkoutError: unknown) {
      setError(checkoutError instanceof Error ? checkoutError.message : copy.checkoutError);
      setLoading(false);
    }
  };

  const title = reason === 'credits'
    ? copy.titleCredits
    : lockedFeature
      ? copy.titleFeature(lockedFeature)
      : copy.titleGeneral;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h5" component="span" fontWeight={800}>{title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          {reason === 'credits'
            ? copy.creditsBody
            : copy.generalBody}
        </Typography>

        <ToggleButtonGroup
          value={interval}
          exclusive
          fullWidth
          onChange={(_, value: BillingInterval | null) => value && setInterval(value)}
          aria-label={copy.billingPeriod}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="monthly">{copy.monthly}</ToggleButton>
          <ToggleButton value="annual">
            {copy.annual}&nbsp;<Chip label={`${copy.save} ${annualSavingsPercent()}%`} color="success" size="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.05)' }}>
          <Typography variant="overline" color="primary.light" fontWeight={800}>Flow Me Pro</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
            <Typography variant="h4" fontWeight={900}>{formatBrl(selected.amountCents)}</Typography>
            <Typography color="text.secondary">{copy.perMonth}</Typography>
          </Box>
          {interval === 'annual' && (
            <Typography variant="body2" color="text.secondary">
              {copy.billedAnnual(formatBrl(selected.billedAmountCents))}
            </Typography>
          )}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {copy.benefits.map(benefit => (
              <Box key={benefit} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                <Typography variant="body2">{benefit}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>{copy.notNow}</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleCheckout}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          sx={{ minHeight: 44, fontWeight: 800 }}
        >
          {copy.cta}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
