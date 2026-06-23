'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Typography } from '@mui/material';
import Link from 'next/link';

type BillingData = {
  alerts: Array<{ id: string; kind: string; severity: string; provider: string | null; status: string; created_at: string }>;
  runs: Array<{ id: string; status: string; inspected: number; mismatched: number; repaired: number; started_at: string }>;
  cancellation_requests: Array<{ id: string; status: string; billing_provider: string | null; reason: string; created_at: string }>;
  subscriptions: Array<{ id: string; user_id: string; plan_code: string; billing_provider: string; status: string }>;
  entitlements: Array<{ user_id: string; plan_code: string; billing_state: string; has_pro: boolean }>;
  failed_payments: Array<{ id: string; user_id: string; kind: string; provider: string; status: string; created_at: string }>;
  ai_costs: Array<{ user_id: string; cost_usd: number }>;
};

export default function BillingAdminPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/billing').then(async res => {
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body?.error?.message || 'Falha ao carregar operações.');
      setData(body);
    }).catch(err => setError(err.message));
  }, []);
  if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto', width: '100%', overflowY: 'auto' }}>
      <Typography variant="h4" fontWeight={800}>Operações de billing</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Alertas, reconciliação, cancelamentos e custo de IA dos últimos 30 dias.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Alertas abertos</Typography><Divider sx={{ my: 1.5 }} />{data.alerts.map(item => <Box key={item.id} sx={{ display: 'flex', gap: 1, py: 0.75 }}><Chip size="small" label={item.severity} color={item.severity === 'critical' ? 'error' : 'warning'} /><Typography variant="body2">{item.kind} · {item.provider || 'interno'}</Typography></Box>)}</Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Reconciliações</Typography><Divider sx={{ my: 1.5 }} />{data.runs.map(item => <Typography key={item.id} variant="body2" sx={{ py: 0.75 }}>{new Date(item.started_at).toLocaleString('pt-BR')} · {item.status} · {item.repaired} reparos / {item.mismatched} divergências</Typography>)}</Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Cancelamentos</Typography><Divider sx={{ my: 1.5 }} /><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{data.cancellation_requests.length} solicitações recentes. Decisões e execução no provider ficam no dashboard dedicado, com justificativa e auditoria.</Typography><Button component={Link} href="/app/admin/cancellations" variant="contained">Abrir management de cancelamentos</Button></Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Custo de IA</Typography><Divider sx={{ my: 1.5 }} />{data.ai_costs.map(item => <Typography key={item.user_id} variant="body2" sx={{ py: 0.75 }}>{item.user_id.slice(0, 8)}… · US$ {item.cost_usd.toFixed(4)}</Typography>)}</Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Assinaturas e acesso</Typography><Divider sx={{ my: 1.5 }} />{data.subscriptions.map(item => { const entitlement = data.entitlements.find(value => value.user_id === item.user_id); return <Typography key={item.id} variant="body2" sx={{ py: 0.75 }}>{item.user_id.slice(0, 8)}… · {item.billing_provider} / {item.status} · {entitlement?.has_pro ? 'Pro ativo' : entitlement?.billing_state || item.plan_code}</Typography>; })}</Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Falhas de pagamento</Typography><Divider sx={{ my: 1.5 }} />{data.failed_payments.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhuma falha recente.</Typography> : data.failed_payments.map(item => <Typography key={item.id} variant="body2" sx={{ py: 0.75 }}>{item.user_id.slice(0, 8)}… · {item.provider} · {item.kind} / {item.status}</Typography>)}</Paper>
      </Box>
    </Box>
  );
}
