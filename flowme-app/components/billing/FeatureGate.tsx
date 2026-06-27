'use client';

import * as React from 'react';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { FeatureKey } from '@/lib/billing/entitlements';
import { getUiLang, type UiLang } from '@/lib/i18n';
import { featureName } from '@/lib/billing/pricing';
import { useSubscription } from './SubscriptionProvider';

type FeatureGateProps = {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

const COPY: Record<UiLang, {
  unknownFeature: string;
  title: (feature: string) => string;
  body: string;
  cta: string;
}> = {
  en: {
    unknownFeature: 'This feature',
    title: feature => `${feature} is part of Pro`,
    body: 'Unlock all of Flow Me and unlimited AI credits.',
    cta: 'Unlock Pro',
  },
  pt: {
    unknownFeature: 'Este recurso',
    title: feature => `${feature} faz parte do Pro`,
    body: 'Desbloqueie tudo do Flow Me e créditos de IA ilimitados.',
    cta: 'Desbloquear Pro',
  },
};

export default function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { loading, isAllowed, openUpgrade } = useSubscription();
  const [lang, setLang] = React.useState<UiLang>('en');

  React.useEffect(() => {
    setLang(getUiLang());
  }, []);

  const copy = COPY[lang];

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><CircularProgress size={24} /></Box>;
  }
  if (isAllowed(feature)) return children;
  if (fallback) return fallback;

  return (
    <Paper variant="outlined" sx={{ p: 4, m: 2, textAlign: 'center', borderRadius: 3 }}>
      <LockOutlinedIcon color="primary" sx={{ fontSize: 36 }} />
      <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
        {copy.title(featureName(feature, lang) || copy.unknownFeature)}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
        {copy.body}
      </Typography>
      <Button variant="contained" color="success" onClick={() => openUpgrade({ feature })} sx={{ minHeight: 44, fontWeight: 800 }}>
        {copy.cta}
      </Button>
    </Paper>
  );
}
