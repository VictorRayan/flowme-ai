'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';

type Locale = 'pt-BR' | 'en-US';
type FunnelBucket = {
  landing_visits: number;
  mql: number;
  mql_monthly: number;
  mql_annual: number;
  mql_unknown_interval: number;
  checkout_visits: number;
  sales: number;
  pix_issued: number;
  pix_paid: number;
  card_attempts: number;
  card_paid: number;
  revenue_cents: number;
};
type FunnelData = {
  since: string;
  until: string;
  start_date: string;
  end_date: string;
  funnel: Record<Locale, FunnelBucket>;
  card_attempts: Array<{ id: string; locale: Locale; status: string; provider: string; amount_cents: number; error_message: string | null; created_at: string }>;
  revenue: { gross_cents: number; refunds_cents: number; chargebacks_cents: number; net_cents: number };
  registered_users: { total: number; free: number; paid: number };
  active_users: { by_hour: Array<{ period: string; users: number }>; by_day: Array<{ period: string; users: number }> };
  onboarding: {
    started: number;
    completed: number;
    logs: Array<{ email: string | null; user_id: string | null; session_id: string | null; started_at: string | null; completed_at: string | null; last_event_at: string; last_step_key: string; last_step_index: number; status: string }>;
  };
};

const LOCALES: Locale[] = ['pt-BR', 'en-US'];

function money(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : 'USD' }).format(cents / 100);
}

function percent(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">{label}</Typography>
      <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}

export default function MarketingFunnelAdminPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
    fetch(`/api/admin/marketing-funnel?${query.toString()}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body?.error?.message || 'Falha ao carregar funil.');
        setData(body);
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar funil.'));
  }, [endDate, startDate]);

  const latestActiveDays = useMemo(() => data?.active_users.by_day.slice(-14) || [], [data]);
  const latestActiveHours = useMemo(() => data?.active_users.by_hour.slice(-24) || [], [data]);

  if (error) return <Box sx={{ p: { xs: 2, md: 4 } }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1240, mx: 'auto', width: '100%', minHeight: 0, overflowY: 'auto' }}>
      <Typography variant="h4" fontWeight={900}>Dashboard gerencial</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Funil por idioma, leads, checkout, pagamentos, onboarding e atividade por período.</Typography>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField label="Start date" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <TextField label="End date" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <Button variant="outlined" onClick={() => { setStartDate(thirtyDaysAgo); setEndDate(today); }}>Últimos 30 dias</Button>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
        <Metric label="Usuários cadastrados" value={data.registered_users.total} hint={`${data.registered_users.free} free · ${data.registered_users.paid} pagos`} />
        <Metric label="Receita líquida" value={money(data.revenue.net_cents, 'pt-BR')} hint={`bruta ${money(data.revenue.gross_cents, 'pt-BR')}`} />
        <Metric label="Janela analisada" value={`${data.start_date} -> ${data.end_date}`} hint={`até ${new Date(data.until).toLocaleDateString('pt-BR')}`} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {LOCALES.map(locale => {
          const item = data.funnel[locale];
          return (
            <Paper key={locale} variant="outlined" sx={{ p: 2.5, borderRadius: 1, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={900}>{locale}</Typography>
                <Chip label={`${percent(item.sales, item.landing_visits)} visita -> venda`} color={item.sales > 0 ? 'success' : 'default'} />
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.2 }}>
                <Metric label="Visitas LP" value={item.landing_visits} />
                <Metric label="MQL" value={item.mql} hint={`${percent(item.mql, item.landing_visits)} da LP`} />
                <Metric label="MQL mensal" value={item.mql_monthly} hint={`${percent(item.mql_monthly, item.mql)} dos MQLs`} />
                <Metric label="MQL anual" value={item.mql_annual} hint={`${percent(item.mql_annual, item.mql)} dos MQLs`} />
                {item.mql_unknown_interval > 0 && <Metric label="MQL sem modalidade" value={item.mql_unknown_interval} />}
                <Metric label="Visitas checkout" value={item.checkout_visits} hint={`${percent(item.checkout_visits, item.mql)} dos MQLs`} />
                <Metric label="Vendas" value={item.sales} hint={money(item.revenue_cents, locale)} />
                <Metric label="Pix emitidos" value={item.pix_issued} />
                <Metric label="Pix pagos" value={item.pix_paid} hint={`${percent(item.pix_paid, item.pix_issued)} conversão`} />
                <Metric label="Cartão tentativas" value={item.card_attempts} />
                <Metric label="Cartões pagos" value={item.card_paid} hint={`${percent(item.card_paid, item.card_attempts)} aprovação`} />
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
          <Typography variant="h6" fontWeight={900}>Usuários ativos por dia</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {latestActiveDays.map(item => <Typography key={item.period} variant="body2">{new Date(item.period).toLocaleDateString('pt-BR')} · {item.users} ativos</Typography>)}
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
          <Typography variant="h6" fontWeight={900}>Usuários ativos por hora</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {latestActiveHours.map(item => <Typography key={item.period} variant="body2">{new Date(item.period).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit' })}h · {item.users} ativos</Typography>)}
          </Stack>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, minWidth: 0, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>Onboarding</Typography>
            <Typography variant="body2" color="text.secondary">Inícios, conclusões e último step visto por usuário/sessão.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={`${data.onboarding.started} iniciados`} />
            <Chip color="success" label={`${data.onboarding.completed} concluídos`} />
            <Chip label={`${percent(data.onboarding.completed, data.onboarding.started)} conclusão`} />
          </Stack>
        </Stack>
        <Stack spacing={1.2}>
          {data.onboarding.logs.length === 0 && <Typography color="text.secondary">Nenhum evento de onboarding no período.</Typography>}
          {data.onboarding.logs.slice(0, 80).map((item, index) => (
            <Box key={`${item.user_id || item.session_id || item.email || index}-${item.last_event_at}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1fr) 110px 160px 1fr' }, gap: 1, alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.email || item.user_id || item.session_id || 'Usuário sem email'}</Typography>
              <Chip size="small" label={item.status} color={item.status === 'completed' ? 'success' : 'default'} />
              <Typography variant="body2">Step {item.last_step_index}: {item.last_step_key}</Typography>
              <Typography variant="body2" color="text.secondary">{new Date(item.last_event_at).toLocaleString('pt-BR')}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, minWidth: 0 }}>
        <Typography variant="h6" fontWeight={900}>Tentativas de cartão</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Resultado e mensagem retornada pelo provider quando houver falha registrada no backend.</Typography>
        <Stack spacing={1.2}>
          {data.card_attempts.length === 0 && <Typography color="text.secondary">Nenhuma tentativa de cartão no período.</Typography>}
          {data.card_attempts.map(item => (
            <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '110px 110px 120px 1fr' }, gap: 1, alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Chip size="small" label={item.locale} />
              <Chip size="small" label={item.status} color={item.status === 'paid' ? 'success' : item.status === 'failed' ? 'error' : 'default'} />
              <Typography variant="body2">{money(item.amount_cents, item.locale)}</Typography>
              <Typography variant="body2" color={item.error_message ? 'error.light' : 'text.secondary'}>
                {item.error_message || 'Sem erro registrado'}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
