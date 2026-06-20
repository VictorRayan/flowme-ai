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

const BENEFITS = [
  'IA ilimitada',
  'Calendário, Today, metas e finanças',
  'Conectores, WhatsApp e automações',
  'Revisões, reuniões e geração de imagens',
];

export default function UpgradeDialog({ open, feature, reason, onClose, onCheckout }: UpgradeDialogProps) {
  const [interval, setInterval] = React.useState<BillingInterval>('annual');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = PRO_PRICES[interval];
  const lockedFeature = featureName(feature);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCheckout(interval);
    } catch (checkoutError: unknown) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Não foi possível abrir o checkout.');
      setLoading(false);
    }
  };

  const title = reason === 'credits'
    ? 'Continue com IA ilimitada'
    : lockedFeature
      ? `Desbloqueie ${lockedFeature}`
      : 'Desbloqueie todo o Flow Me';

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
            ? 'Seus créditos de hoje acabaram. Eles renovam amanhã, ou você pode liberar IA ilimitada agora.'
            : 'Tudo do Flow Me e créditos de IA ilimitados em um único plano.'}
        </Typography>

        <ToggleButtonGroup
          value={interval}
          exclusive
          fullWidth
          onChange={(_, value: BillingInterval | null) => value && setInterval(value)}
          aria-label="Período de cobrança"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="monthly">Mensal</ToggleButton>
          <ToggleButton value="annual">
            Anual&nbsp;<Chip label={`Economize ${annualSavingsPercent()}%`} color="success" size="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.05)' }}>
          <Typography variant="overline" color="primary.light" fontWeight={800}>Flow Me Pro</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
            <Typography variant="h4" fontWeight={900}>{formatBrl(selected.amountCents)}</Typography>
            <Typography color="text.secondary">/mês</Typography>
          </Box>
          {interval === 'annual' && (
            <Typography variant="body2" color="text.secondary">
              {formatBrl(selected.billedAmountCents)} cobrados uma vez por ano
            </Typography>
          )}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {BENEFITS.map(benefit => (
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
        <Button onClick={onClose} color="inherit" disabled={loading}>Agora não</Button>
        <Button
          variant="contained"
          onClick={handleCheckout}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          sx={{ minHeight: 44 }}
        >
          Desbloquear Pro
        </Button>
      </DialogActions>
    </Dialog>
  );
}
