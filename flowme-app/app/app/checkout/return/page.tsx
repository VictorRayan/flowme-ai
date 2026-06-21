'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

function CheckoutReturnContent() {
  const params = useSearchParams();
  const attemptId = params.get('attempt_id');
  const [status, setStatus] = React.useState<string>('awaiting_payment');

  React.useEffect(() => {
    if (!attemptId) return;
    let active = true;
    const check = async () => {
      const response = await fetch(`/api/billing/checkout/${attemptId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (active && payload.checkout?.status) setStatus(payload.checkout.status);
    };
    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attemptId]);

  const paid = status === 'paid';
  const failed = ['failed', 'canceled', 'refunded', 'expired'].includes(status);
  return <Box sx={{ minHeight: '75vh', display: 'grid', placeItems: 'center', p: 2 }}><Paper sx={{ maxWidth: 520, p: 4, borderRadius: 4, textAlign: 'center' }}><Stack spacing={2} alignItems="center">{paid ? <CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} /> : <CircularProgress />}<Typography variant="h4" fontWeight={900}>{paid ? 'Pagamento confirmado!' : failed ? 'Pagamento não concluído' : 'Confirmando seu pagamento…'}</Typography><Typography color="text.secondary">{paid ? 'Seu Flow Me Pro já está liberado.' : 'A confirmação segura vem do provedor e pode levar alguns instantes.'}</Typography>{failed && <Alert severity="error">Você pode voltar ao checkout e tentar novamente.</Alert>}<Button href={paid ? '/app' : '/app/checkout'} variant="contained">{paid ? 'Entrar no Flow Me' : 'Voltar ao checkout'}</Button></Stack></Paper></Box>;
}

export default function CheckoutReturnPage() {
  return <React.Suspense fallback={<Box sx={{ minHeight: '75vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><CheckoutReturnContent /></React.Suspense>;
}
