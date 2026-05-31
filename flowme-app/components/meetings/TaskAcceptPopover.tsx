'use client';

import * as React from 'react';
import {
  Popover, Stack, Typography, Button, TextField, Select, MenuItem, CircularProgress, Alert, ToggleButton, ToggleButtonGroup, FormControl, InputLabel,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface TaskAcceptPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  meetingId: string;
  taskId: string;
  taskDescription: string;
  onClose: () => void;
  onAccepted: () => void;
}

interface LinkedAccount { id: string; name: string }
interface ActionPlan { id: string; title: string }

function defaultStartIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

export default function TaskAcceptPopover({ open, anchorEl, meetingId, taskId, taskDescription, onClose, onAccepted }: TaskAcceptPopoverProps) {
  const [target, setTarget] = React.useState<'calendar' | 'action_plan'>('action_plan');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accounts, setAccounts] = React.useState<LinkedAccount[]>([]);
  const [plans, setPlans] = React.useState<ActionPlan[]>([]);
  const [accountId, setAccountId] = React.useState('');
  const [planId, setPlanId] = React.useState('');
  const [startLocal, setStartLocal] = React.useState(defaultStartIso());
  const [durationMinutes, setDurationMinutes] = React.useState(30);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    fetch('/api/linked-accounts').then((r) => r.ok ? r.json() : null).then((b) => {
      const list = ((b?.accounts || b?.linked_accounts || []) as any[]).filter((a) => a.is_active);
      setAccounts(list.map((a) => ({ id: a.id, name: a.name })));
      if (list[0]) setAccountId(list[0].id);
    }).catch(() => {});
    fetch('/api/action-plans').then((r) => r.ok ? r.json() : null).then((b) => {
      const list = ((b?.action_plans || b?.plans || []) as any[]);
      setPlans(list.map((a) => ({ id: a.id, title: a.title })));
      if (list[0]) setPlanId(list[0].id);
    }).catch(() => {});
  }, [open]);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { target };
      if (target === 'calendar') {
        if (!accountId) throw new Error('Selecione um calendário');
        const start = new Date(startLocal);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        body.linked_account_id = accountId;
        body.start_at = start.toISOString();
        body.end_at = end.toISOString();
      } else {
        if (!planId) throw new Error('Selecione um plano');
        body.action_plan_id = planId;
      }
      const res = await fetch(`/api/meetings/${meetingId}/tasks/${taskId}/accept`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.error?.message || 'accept_failed');
      onAccepted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'accept_failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      PaperProps={{ sx: { p: 2, width: 320 } }}
    >
      <Stack spacing={1.5}>
        <Typography variant="caption" color="text.secondary">Aceitar tarefa</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{taskDescription}</Typography>

        <ToggleButtonGroup
          value={target}
          exclusive
          size="small"
          onChange={(_, v) => v && setTarget(v)}
          fullWidth
        >
          <ToggleButton value="action_plan" data-testid="task-target-plan"><AssignmentIcon fontSize="small" sx={{ mr: 0.5 }} />Plano</ToggleButton>
          <ToggleButton value="calendar" data-testid="task-target-calendar"><EventIcon fontSize="small" sx={{ mr: 0.5 }} />Calendário</ToggleButton>
        </ToggleButtonGroup>

        {target === 'calendar' && (
          <>
            <FormControl size="small" fullWidth>
              <InputLabel>Calendário</InputLabel>
              <Select value={accountId} label="Calendário" onChange={(e) => setAccountId(String(e.target.value))}>
                {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField type="datetime-local" size="small" label="Início" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="number" size="small" label="Duração (min)" value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(5, Math.min(480, Number(e.target.value) || 30)))} fullWidth />
          </>
        )}

        {target === 'action_plan' && (
          <FormControl size="small" fullWidth>
            <InputLabel>Plano</InputLabel>
            <Select value={planId} label="Plano" onChange={(e) => setPlanId(String(e.target.value))}>
              {plans.length === 0 && <MenuItem value="" disabled>Nenhum plano disponível</MenuItem>}
              {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            size="small"
            variant="contained"
            startIcon={submitting ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
            onClick={handleAccept}
            disabled={submitting || (target === 'calendar' && !accountId) || (target === 'action_plan' && !planId)}
            data-testid="task-accept-confirm"
          >
            Aceitar
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
