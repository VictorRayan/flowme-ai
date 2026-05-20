'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { resolveUiLang, type UiLang } from '@/lib/i18n';

type ReminderStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';
type ReminderChannel = 'default' | 'whatsapp' | 'instagram' | 'push';

type Reminder = {
  id: string;
  title: string | null;
  message: string;
  scheduled_for: string;
  timezone: string;
  status: ReminderStatus;
  channel_preference: ReminderChannel;
  source_title: string | null;
  source_start_at: string | null;
};

const STATUSES: ReminderStatus[] = ['scheduled', 'sent', 'failed', 'cancelled'];

const STRINGS = {
  en: {
    title: 'Reminders',
    description: 'Manage reminder notifications created by you or Balys.',
    newReminder: 'New reminder',
    refresh: 'Refresh',
    empty: 'No reminders here yet.',
    message: 'Message',
    when: 'When',
    channel: 'Channel',
    create: 'Create',
    cancel: 'Cancel',
    close: 'Close',
    cancelReminder: 'Cancel reminder',
    cancelConfirm: 'Cancel this reminder?',
    created: 'Reminder created.',
    cancelled: 'Reminder cancelled.',
    default: 'Default',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    push: 'Push',
    event: 'Event',
    standalone: 'Standalone reminder',
    status: {
      scheduled: 'Scheduled',
      sent: 'Sent',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
  },
  pt: {
    title: 'Lembretes',
    description: 'Gerencie notificações de lembrete criadas por você ou pelo Balys.',
    newReminder: 'Novo lembrete',
    refresh: 'Atualizar',
    empty: 'Nenhum lembrete aqui ainda.',
    message: 'Mensagem',
    when: 'Quando',
    channel: 'Canal',
    create: 'Criar',
    cancel: 'Cancelar',
    close: 'Fechar',
    cancelReminder: 'Cancelar lembrete',
    cancelConfirm: 'Cancelar este lembrete?',
    created: 'Lembrete criado.',
    cancelled: 'Lembrete cancelado.',
    default: 'Padrão',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    push: 'Push',
    event: 'Evento',
    standalone: 'Lembrete solto',
    status: {
      scheduled: 'Agendados',
      sent: 'Enviados',
      failed: 'Falhos',
      cancelled: 'Cancelados',
    },
  },
};

function toDateTimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultReminderTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return toDateTimeLocal(date);
}

function formatReminderTime(value: string, uiLang: UiLang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(uiLang === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function channelLabel(channel: ReminderChannel, t: typeof STRINGS.en): string {
  if (channel === 'whatsapp') return t.whatsapp;
  if (channel === 'instagram') return t.instagram;
  if (channel === 'push') return t.push;
  return t.default;
}

export default function RemindersPanel() {
  const [uiLang, setUiLang] = useState<UiLang>('en');
  const [status, setStatus] = useState<ReminderStatus>('scheduled');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState(defaultReminderTime);
  const [channel, setChannel] = useState<ReminderChannel>('default');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = STRINGS[uiLang];

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reminders?status=${status}&limit=50`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load reminders');
      setReminders(data.reminders || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const canCreate = useMemo(() => message.trim().length > 0 && scheduledFor.trim().length > 0, [message, scheduledFor]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const scheduledAt = new Date(scheduledFor);
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          scheduled_for: scheduledAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          channel_preference: channel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create reminder');
      setDialogOpen(false);
      setMessage('');
      setScheduledFor(defaultReminderTime());
      setChannel('default');
      setStatus('scheduled');
      setSuccess(t.created);
      await fetchReminders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (reminderId: string) => {
    if (!confirm(t.cancelConfirm)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to cancel reminder');
      setSuccess(t.cancelled);
      await fetchReminders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reminder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
        <Tabs
          value={status}
          onChange={(_, next) => setStatus(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40 }}
        >
          {STATUSES.map(item => (
            <Tab key={item} value={item} label={t.status[item]} sx={{ minHeight: 40 }} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={1}>
          <IconButton aria-label={t.refresh} onClick={fetchReminders} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {t.newReminder}
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : reminders.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <NotificationsIcon sx={{ color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">{t.empty}</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {reminders.map((reminder, index) => (
            <React.Fragment key={reminder.id}>
              <ListItem
                disablePadding
                secondaryAction={reminder.status === 'scheduled' ? (
                  <IconButton edge="end" aria-label={t.cancelReminder} color="error" onClick={() => handleCancel(reminder.id)} disabled={saving}>
                    <DeleteIcon />
                  </IconButton>
                ) : undefined}
                sx={{ py: 1.5, pr: reminder.status === 'scheduled' ? 6 : 0 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                      <Typography fontWeight={600}>{reminder.message}</Typography>
                      <Chip size="small" icon={reminder.channel_preference === 'whatsapp' ? <WhatsAppIcon /> : undefined} label={channelLabel(reminder.channel_preference, t)} variant="outlined" />
                    </Stack>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {formatReminderTime(reminder.scheduled_for, uiLang)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {reminder.source_title ? `${t.event}: ${reminder.source_title}` : t.standalone}
                      </Typography>
                    </Stack>
                  }
                />
              </ListItem>
              {index < reminders.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t.newReminder}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t.message}
              value={message}
              onChange={e => setMessage(e.target.value)}
              multiline
              minRows={3}
              autoFocus
            />
            <TextField
              label={t.when}
              type="datetime-local"
              value={scheduledFor}
              onChange={e => setScheduledFor(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl>
              <InputLabel>{t.channel}</InputLabel>
              <Select value={channel} label={t.channel} onChange={e => setChannel(e.target.value as ReminderChannel)}>
                <MenuItem value="default">{t.default}</MenuItem>
                <MenuItem value="whatsapp">{t.whatsapp}</MenuItem>
                <MenuItem value="instagram">{t.instagram}</MenuItem>
                <MenuItem value="push">{t.push}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.close}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canCreate || saving}>
            {saving ? <CircularProgress size={18} /> : t.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

