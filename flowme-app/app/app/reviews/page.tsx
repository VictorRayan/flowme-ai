'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import InsightsIcon from '@mui/icons-material/Insights';
import BalysMarkdown from '@/components/markdown/BalysMarkdown';

interface Review {
  period_start: string;
  period_end: string;
  status: string;
  evidence: {
    metrics: {
      commitment_count: number;
      completed_count: number;
      not_done_count: number;
      unanswered_count: number;
      late_postponement_count: number;
    };
  };
  review_content: {
    what_happened: string;
    detected_pattern: string;
    goal_impact: string;
    recommendation: string;
  } | null;
  suggested_action_plan: { offered?: boolean; reason?: string } | null;
}

interface MonthlyReview {
  period_start: string;
  period_end: string;
  status: string;
  evidence: {
    financial_summary: {
      currency: string;
      total_income: number;
      total_expenses: number;
      total_invested: number;
      net_balance: number;
      investment_rate: number | null;
      category_breakdown: Array<{ category: string; amount: number; share: number }>;
      goal_alignment: Array<{ goal_title: string; monthly_target: number; actual_saved: number; gap: number; adherence: number; currency: string; status: string }>;
    };
    alerts: string[];
  };
  review_content: {
    financial_health: string;
    spending_pattern: string;
    investment_guidance: string;
    cuts_to_consider: string;
    next_month_focus: string;
  } | null;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
}

export default function WeeklyReviewsPage() {
  const [review, setReview] = useState<Review | null>(null);
  const [monthlyReview, setMonthlyReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [weeklyRes, monthlyRes] = await Promise.all([
      fetch('/api/weekly-reviews/latest'),
      fetch('/api/monthly-reviews/latest'),
    ]);
    const weeklyBody = await weeklyRes.json().catch(() => null);
    const monthlyBody = await monthlyRes.json().catch(() => null);
    setReview(weeklyBody?.review || null);
    setMonthlyReview(monthlyBody?.review || null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/api/weekly-reviews/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefing, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) setError(body?.error?.message || 'Não foi possível gerar a revisão.');
    else {
      setReview(body.review);
      setBriefing('');
    }
    setSaving(false);
  };

  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;
  if (!review && !monthlyReview) return <Box sx={{ p: 4 }}><Typography>Nenhuma revisão disponível ainda.</Typography></Box>;

  const metrics = review?.evidence.metrics;
  const monthlySummary = monthlyReview?.evidence.financial_summary;
  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      maxWidth: 1120,
      mx: 'auto',
      width: '100%',
      minHeight: '100%',
      background: 'radial-gradient(circle at 12% 0%, rgba(99,102,241,0.16), transparent 34%), radial-gradient(circle at 88% 20%, rgba(34,211,238,0.10), transparent 30%)',
    }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
        <Box>
          <Chip icon={<AutoAwesomeIcon />} label="Balys Review OS" size="small" sx={{ mb: 1, color: '#c4b5fd', bgcolor: 'rgba(99,102,241,0.14)', border: '1px solid rgba(167,139,250,0.22)' }} />
          <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: -1 }}>Revisões</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>Clareza executiva para corrigir rota, proteger metas e decidir o próximo movimento.</Typography>
        </Box>
      </Stack>

      {review && (
        <>
          <Typography variant="h5" fontWeight={800} sx={{ mt: 3 }}>Revisão semanal</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{review.period_start} a {review.period_end}</Typography>

          {metrics && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
              <Metric label="Compromissos" value={metrics.commitment_count} />
              <Metric label="Feitos" value={metrics.completed_count} />
              <Metric label="Não feitos" value={metrics.not_done_count} />
              <Metric label="Sem resposta" value={metrics.unanswered_count} />
              <Metric label="Adiamentos tardios" value={metrics.late_postponement_count} />
            </Stack>
          )}

          {review.status === 'awaiting_briefing' && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>Conte brevemente como foi sua semana</Typography>
            <Typography color="text.secondary" sx={{ my: 1.5 }}>Inclua imprevistos, dificuldades e o que mais afetou sua execução.</Typography>
            <TextField fullWidth multiline minRows={4} value={briefing} onChange={(event) => setBriefing(event.target.value)} />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button variant="contained" sx={{ mt: 2, minHeight: 44 }} disabled={saving || briefing.trim().length < 5} onClick={submit}>
              {saving ? 'Gerando revisão...' : 'Gerar revisão'}
            </Button>
          </CardContent>
        </Card>
          )}

          {review.review_content && (
            <Stack spacing={2}>
              <ReviewCard icon={<InsightsIcon />} tone="cyan" title="O que aconteceu" text={review.review_content.what_happened} />
              <ReviewCard icon={<TrendingUpIcon />} tone="amber" title="Padrão detectado" text={review.review_content.detected_pattern} />
              <ReviewCard icon={<TrackChangesIcon />} tone="violet" title="Impacto nas metas" text={review.review_content.goal_impact} />
              <ReviewCard icon={<AutoAwesomeIcon />} tone="green" title="Recomendação" text={review.review_content.recommendation} featured />
              {review.suggested_action_plan?.offered && <Alert severity="info">{review.suggested_action_plan.reason}</Alert>}
            </Stack>
          )}
        </>
      )}

      {monthlyReview && monthlySummary && (
        <Box sx={{ mt: 5 }}>
          <Typography variant="h5" fontWeight={800}>Revisão mensal financeira</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{monthlyReview.period_start} a {monthlyReview.period_end}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            <Metric label="Gastos" value={money(monthlySummary.total_expenses, monthlySummary.currency)} />
            <Metric label="Receitas" value={money(monthlySummary.total_income, monthlySummary.currency)} />
            <Metric label="Investido" value={money(monthlySummary.total_invested, monthlySummary.currency)} />
            <Metric label="Saldo" value={money(monthlySummary.net_balance, monthlySummary.currency)} />
            <Metric label="Investimento" value={monthlySummary.investment_rate === null ? '-' : `${Math.round(monthlySummary.investment_rate * 100)}%`} />
          </Stack>
          {monthlyReview.evidence.alerts.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{monthlyReview.evidence.alerts.join(' ')}</Alert>}
          {monthlySummary.goal_alignment?.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography fontWeight={700}>Aderência às metas financeiras</Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {monthlySummary.goal_alignment.map(item => (
                    <Typography key={item.goal_title} color="text.secondary">
                      {item.goal_title}: {money(item.actual_saved, item.currency)} de {money(item.monthly_target, item.currency)}
                      {item.status === 'behind' ? ` (${money(Math.abs(item.gap), item.currency)} abaixo)` : ' (no ritmo)'}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
          {monthlyReview.review_content && (
            <Stack spacing={2}>
              <ReviewCard icon={<InsightsIcon />} tone="green" title="Saúde financeira" text={monthlyReview.review_content.financial_health} />
              <ReviewCard icon={<TrendingUpIcon />} tone="amber" title="Padrão de gastos" text={monthlyReview.review_content.spending_pattern} />
              <ReviewCard icon={<TrackChangesIcon />} tone="violet" title="Investimentos" text={monthlyReview.review_content.investment_guidance} />
              <ReviewCard icon={<AutoAwesomeIcon />} tone="cyan" title="Cortes a considerar" text={monthlyReview.review_content.cuts_to_consider} />
              <ReviewCard icon={<AutoAwesomeIcon />} tone="green" title="Foco do próximo mês" text={monthlyReview.review_content.next_month_focus} featured />
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card sx={{
    flex: 1,
    minWidth: { sm: 150 },
    border: '1px solid rgba(129,140,248,0.18)',
    background: 'linear-gradient(145deg, rgba(30,41,59,0.94), rgba(15,23,42,0.88))',
    boxShadow: '0 18px 46px rgba(0,0,0,0.24)',
  }}><CardContent><Typography variant="h4" fontWeight={900}>{value}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontSize: 14 }}>{label}</Typography></CardContent></Card>;
}

function ReviewCard({ title, text, icon, tone = 'violet', featured = false }: { title: string; text: string; icon: React.ReactNode; tone?: 'violet' | 'cyan' | 'amber' | 'green'; featured?: boolean }) {
  const colors = {
    violet: { main: '#a78bfa', bg: 'rgba(99,102,241,0.14)' },
    cyan: { main: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
    amber: { main: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    green: { main: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  }[tone];
  return <Card sx={{
    position: 'relative',
    overflow: 'hidden',
    border: `1px solid ${featured ? colors.main : 'rgba(129,140,248,0.18)'}`,
    background: featured
      ? `linear-gradient(145deg, ${colors.bg}, rgba(15,23,42,0.96))`
      : 'linear-gradient(145deg, rgba(17,24,39,0.96), rgba(15,23,42,0.90))',
    boxShadow: featured ? `0 24px 70px ${colors.bg}` : '0 18px 46px rgba(0,0,0,0.22)',
    '&:before': {
      content: '""',
      position: 'absolute',
      inset: '0 auto 0 0',
      width: 4,
      bgcolor: colors.main,
      boxShadow: `0 0 28px ${colors.main}`,
    },
  }}>
    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', color: colors.main, bgcolor: colors.bg }}>{icon}</Box>
        <Typography fontWeight={850} sx={{ fontSize: 18 }}>{title}</Typography>
      </Stack>
      <Box sx={{ color: 'text.secondary', fontSize: 16, lineHeight: 1.75 }}>
        <BalysMarkdown text={text} />
      </Box>
    </CardContent>
  </Card>;
}
