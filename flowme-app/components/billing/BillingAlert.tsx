'use client';

import * as React from 'react';
import { Alert, Button, Collapse } from '@mui/material';

type BillingNotification = {
  id: string;
  kind: 'payment_failed' | 'payment_action_required' | 'invoice_finalization_failed';
  provider: 'stripe' | 'apple' | 'google';
};

function message(notification: BillingNotification): string {
  if (notification.kind === 'payment_action_required') return 'Seu pagamento precisa de confirmação para manter o Flow Me Pro.';
  if (notification.kind === 'invoice_finalization_failed') return 'Não foi possível preparar a renovação do Flow Me Pro.';
  return 'Não conseguimos renovar seu Flow Me Pro. Atualize sua forma de pagamento.';
}

function managementUrl(provider: BillingNotification['provider']): string {
  if (provider === 'apple') return 'https://apps.apple.com/account/subscriptions';
  if (provider === 'google') return 'https://play.google.com/store/account/subscriptions';
  return '/app/settings?billing=payment_failed';
}

export default function BillingAlert() {
  const [notification, setNotification] = React.useState<BillingNotification | null>(null);

  React.useEffect(() => {
    fetch('/api/billing/notifications', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => setNotification(payload?.notification || null))
      .catch(() => undefined);
  }, []);

  const dismiss = async () => {
    if (!notification) return;
    const current = notification;
    setNotification(null);
    await fetch('/api/billing/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id }),
    }).catch(() => undefined);
  };

  return (
    <Collapse in={Boolean(notification)}>
      {notification && (
        <Alert
          severity="warning"
          onClose={dismiss}
          action={(
            <Button href={managementUrl(notification.provider)} color="inherit" size="small">
              {notification.provider === 'apple' ? 'Abrir App Store' : notification.provider === 'google' ? 'Abrir Google Play' : 'Atualizar pagamento'}
            </Button>
          )}
          sx={{ borderRadius: 0 }}
        >
          {message(notification)}
        </Alert>
      )}
    </Collapse>
  );
}
