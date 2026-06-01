'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';

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

export default function WeeklyReviewsPage() {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/weekly-reviews/latest');
    const body = await res.json().catch(() => null);
    setReview(body?.review || null);
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
  if (!review) return <Box sx={{ p: 4 }}><Typography>Nenhuma revisão semanal disponível ainda.</Typography></Box>;

  const metrics = review.evidence.metrics;
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800}>Revisão semanal</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{review.period_start} a {review.period_end}</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <Metric label="Compromissos" value={metrics.commitment_count} />
        <Metric label="Feitos" value={metrics.completed_count} />
        <Metric label="Não feitos" value={metrics.not_done_count} />
        <Metric label="Sem resposta" value={metrics.unanswered_count} />
        <Metric label="Adiamentos tardios" value={metrics.late_postponement_count} />
      </Stack>

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
          <ReviewCard title="O que aconteceu" text={review.review_content.what_happened} />
          <ReviewCard title="Padrão detectado" text={review.review_content.detected_pattern} />
          <ReviewCard title="Impacto nas metas" text={review.review_content.goal_impact} />
          <ReviewCard title="Recomendação" text={review.review_content.recommendation} />
          {review.suggested_action_plan?.offered && <Alert severity="info">{review.suggested_action_plan.reason}</Alert>}
        </Stack>
      )}
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card sx={{ flex: 1 }}><CardContent><Typography variant="h5" fontWeight={800}>{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></CardContent></Card>;
}

function ReviewCard({ title, text }: { title: string; text: string }) {
  return <Card><CardContent><Typography fontWeight={700}>{title}</Typography><Typography color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>{text}</Typography></CardContent></Card>;
}
