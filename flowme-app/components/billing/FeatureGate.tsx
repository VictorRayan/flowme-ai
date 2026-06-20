'use client';

import * as React from 'react';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { FeatureKey } from '@/lib/billing/entitlements';
import { featureName } from '@/lib/billing/pricing';
import { useSubscription } from './SubscriptionProvider';

type FeatureGateProps = {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { loading, isAllowed, openUpgrade } = useSubscription();

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><CircularProgress size={24} /></Box>;
  }
  if (isAllowed(feature)) return children;
  if (fallback) return fallback;

  return (
    <Paper variant="outlined" sx={{ p: 4, m: 2, textAlign: 'center', borderRadius: 3 }}>
      <LockOutlinedIcon color="primary" sx={{ fontSize: 36 }} />
      <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
        {featureName(feature) || 'Este recurso'} faz parte do Pro
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
        Desbloqueie tudo do Flow Me e créditos de IA ilimitados.
      </Typography>
      <Button variant="contained" onClick={() => openUpgrade({ feature })} sx={{ minHeight: 44 }}>
        Desbloquear Pro
      </Button>
    </Paper>
  );
}
