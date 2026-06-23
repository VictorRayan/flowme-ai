'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, MenuItem, Paper, TextField, Typography } from '@mui/material';

type CancellationRequest = {
  id: string; user_id: string; billing_provider: string | null; status: string; reason_code: string; reason: string;
  disappointing_features: string; unmet_expectation: string; would_accept_human_support: boolean; locale: string;
  decision: string | null; decision_reason: string | null; provider_action_status: string; provider_action_error: string | null;
  created_at: string; assigned_to: string | null;
};

const OPEN_STATUSES = ['open', 'in_review', 'needs_info', 'approved_cancel', 'canceling', 'provider_action_failed'];

export default function CancellationManagementPage() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('active');
  const [decisionReason, setDecisionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'period_end' | 'immediate'>('period_end');
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cancellation-requests');
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'Falha ao carregar solicitações');
      setRequests(data.requests || []);
      setSelectedId(current => current || data.requests?.[0]?.id || null);
    } catch (requestError: unknown) { setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar solicitações'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => filter === 'active' ? requests.filter(request => OPEN_STATUSES.includes(request.status)) : filter === 'all' ? requests : requests.filter(request => request.status === filter), [filter, requests]);
  const selected = requests.find(request => request.id === selectedId) || null;

  const mutate = async (path: string, body: Record<string, unknown>, method = 'POST') => {
    setError(null);
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.ok) { setError(data?.error?.message || 'Operação não concluída'); return; }
    await load();
  };

  return <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: 'auto' }}>
    <Typography variant="h4" fontWeight={800}>Management de cancelamentos</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Fila, decisão humana, execução no provider e trilha auditável.</Typography>
    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>{['active', 'open', 'in_review', 'needs_info', 'approved_cancel', 'provider_action_failed', 'all'].map(status => <Chip key={status} clickable color={filter === status ? 'primary' : 'default'} label={`${status} (${status === 'active' ? requests.filter(item => OPEN_STATUSES.includes(item.status)).length : status === 'all' ? requests.length : requests.filter(item => item.status === status).length})`} onClick={() => setFilter(status)} />)}</Box>
    {loading ? <CircularProgress /> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 2 }}>
      <Paper variant="outlined" sx={{ maxHeight: 720, overflowY: 'auto' }}>{visible.map(request => <Box key={request.id} onClick={() => { setSelectedId(request.id); setArmed(false); }} sx={{ p: 2, cursor: 'pointer', bgcolor: selectedId === request.id ? 'action.selected' : 'transparent', borderBottom: 1, borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography fontWeight={700}>{request.reason_code}</Typography><Chip size="small" label={request.status} /></Box><Typography variant="body2" color="text.secondary">{request.billing_provider || 'sem provider'} · {new Date(request.created_at).toLocaleDateString('pt-BR')}</Typography><Typography variant="body2" sx={{ mt: 1 }}>{request.reason.slice(0, 110)}…</Typography></Box>)}</Paper>
      {selected ? <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}><Chip label={selected.status} color="primary" /><Chip label={selected.billing_provider || 'sem provider'} /><Chip label={selected.locale} /><Chip label={selected.would_accept_human_support ? 'aceita suporte' : 'não aceita suporte'} /></Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Usuário</Typography><Typography>{selected.user_id}</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography fontWeight={700}>Motivo detalhado</Typography><Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{selected.reason}</Typography>
        <Typography fontWeight={700} sx={{ mt: 2 }}>Funcionalidades que decepcionaram</Typography><Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{selected.disappointing_features}</Typography>
        <Typography fontWeight={700} sx={{ mt: 2 }}>Expectativa não atendida</Typography><Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{selected.unmet_expectation}</Typography>
        <Divider sx={{ my: 2 }} />
        {['open', 'in_review', 'needs_info'].includes(selected.status) && <>
          <TextField fullWidth multiline minRows={2} label="Notas internas / justificativa" value={decisionReason} onChange={event => setDecisionReason(event.target.value)} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Button disabled={notes.length > 4000} onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}`, { status: 'in_review', admin_notes: notes || decisionReason }, 'PATCH')}>Assumir análise</Button>
            <Button onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}`, { status: 'needs_info', admin_notes: notes || decisionReason }, 'PATCH')}>Pedir informações</Button>
            <Button color="success" disabled={decisionReason.trim().length < 10} onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}/decision`, { decision: 'retained', reason: decisionReason })}>Reter</Button>
            <Button color="warning" disabled={decisionReason.trim().length < 10} onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}/decision`, { decision: 'rejected', reason: decisionReason })}>Negar</Button>
            <Button color="error" variant="contained" disabled={decisionReason.trim().length < 10} onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}/decision`, { decision: 'approved_cancel', reason: decisionReason })}>Aprovar cancelamento</Button>
          </Box>
        </>}
        {(selected.status === 'approved_cancel' || selected.status === 'provider_action_failed') && <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'error.main', borderRadius: 2 }}>
          <Typography fontWeight={700}>Execução no provider</Typography><Typography variant="body2" color="text.secondary">Esta ação interrompe a recorrência. Confirme em duas etapas.</Typography>
          <TextField select size="small" label="Efeito" value={mode} onChange={event => { setMode(event.target.value as typeof mode); setArmed(false); }} sx={{ mt: 2, minWidth: 220 }}><MenuItem value="period_end">Fim do período pago</MenuItem><MenuItem value="immediate">Imediato</MenuItem></TextField>
          <Box sx={{ mt: 2 }}>{!armed ? <Button color="error" variant="outlined" onClick={() => setArmed(true)}>Preparar execução</Button> : <Button color="error" variant="contained" onClick={() => void mutate(`/api/admin/cancellation-requests/${selected.id}/execute`, { mode })}>Confirmar e executar no provider</Button>}</Box>
        </Box>}
        {selected.provider_action_status !== 'not_started' && <Alert severity={selected.provider_action_status === 'failed' ? 'error' : 'info'} sx={{ mt: 2 }}>Provider: {selected.provider_action_status}{selected.provider_action_error ? ` · ${selected.provider_action_error}` : ''}</Alert>}
      </Paper> : <Alert severity="info">Selecione uma solicitação.</Alert>}
    </Box>}
  </Box>;
}
