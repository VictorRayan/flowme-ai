'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

function PublicCheckoutReturnContent() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const claimError = params.get('claim_error');
  const [status, setStatus] = React.useState<string>('awaiting_payment');
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    if (!token) return;
    let active = true;
    const check = async () => {
      const response = await fetch(`/api/billing/public-checkout/status?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!active) return;
      if (payload.checkout?.status) setStatus(payload.checkout.status);
      if (payload.checkout?.email) setEmail(payload.checkout.email);
    };
    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  const paid = status === 'paid' || status === 'claimed';
  const failed = ['failed', 'canceled', 'refunded', 'expired'].includes(status);
  const claimHref = `/login?claim_token=${encodeURIComponent(token)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  const errorMessage = claimError === 'email_mismatch'
    ? `Esta compra foi feita para ${email || 'outro email'}. Entre com esse email para liberar o Pro.`
    : claimError === 'not_paid'
      ? 'Ainda não recebemos a confirmação segura do pagamento.'
      : claimError
        ? 'Não foi possível liberar automaticamente. Tente entrar novamente com o email da compra.'
        : '';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: '#0d0f14' }}>
      <Paper sx={{ maxWidth: 560, p: { xs: 3, sm: 4 }, borderRadius: 4, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          {paid ? <CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} /> : <CircularProgress />}
          <Typography variant="h4" fontWeight={900}>{paid ? 'Pagamento confirmado!' : failed ? 'Pagamento não concluído' : 'Confirmando seu pagamento...'}</Typography>
          {email && <Typography color="text.secondary">Seu acesso será liberado para <strong>{email}</strong>.</Typography>}
          {!email && <Typography color="text.secondary">A confirmação segura vem do provedor e pode levar alguns instantes.</Typography>}
          {errorMessage && <Alert severity="warning">{errorMessage}</Alert>}
          {failed && <Alert severity="error">Você pode voltar ao checkout e tentar novamente.</Alert>}
          <Button href={paid ? claimHref : '/checkout'} variant="contained" color={paid ? 'success' : 'primary'} size="large">
            {paid ? 'Começar a usar o Flow Me' : 'Voltar ao checkout'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default function PublicCheckoutReturnPage() {
  return <React.Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><PublicCheckoutReturnContent /></React.Suspense>;
}
