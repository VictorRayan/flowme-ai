'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Chip, CircularProgress,
  Alert, Divider, Stack, FormControlLabel, Switch,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { resolveUiLang, type UiLang } from '@/lib/i18n';
import { intlLocale } from '@/lib/datetime';

type ChannelStatus = 'none' | 'pending_verification' | 'active';

interface Channel {
  id: string;
  phone: string;
  status: ChannelStatus;
  verified_at: string | null;
  reminders_enabled?: boolean;
  is_default_reminder_channel?: boolean;
}

const STRINGS = {
  en: {
    codeSent: 'Verification code sent to your WhatsApp. Check your messages!',
    connected: (date: string) => `Connected since ${date}`,
    connectedSimple: 'Connected',
    active: 'Active',
    disconnect: 'Disconnect',
    disconnectConfirm: 'Disconnect your WhatsApp number from Balys?',
    disconnected: 'WhatsApp disconnected.',
    whatsappConnected: 'WhatsApp connected! You can now chat with Balys on WhatsApp.',
    enterCode: 'We sent a 6-digit code to your WhatsApp. Enter it below to activate Balys.',
    codeLabel: '6-digit code',
    verify: 'Verify',
    useDifferentNumber: 'Use a different number',
    enterNumber: 'Enter your WhatsApp number in international format (e.g. +5511999999999).',
    willSendFrom: (phone: string) => ` Balys will send a verification code from ${phone}.`,
    numberLabel: 'WhatsApp number',
    sendCode: 'Send verification code',
    footerNote: 'Once verified, send any message to Balys on WhatsApp — text, image, or voice note — and Balys will reply with your full context and tools.',
    balysMessages: 'Balys messages',
    balysMessagesCaption: 'This number can receive and reply to Balys chats.',
    reminders: 'Reminders',
    remindersCaption: 'Use this WhatsApp number for reminder notifications.',
    defaultReminderChannel: 'Default reminder channel',
    defaultReminderChannelCaption: 'Balys will choose WhatsApp when no reminder channel is specified.',
    settingsSaved: 'Channel settings saved.',
  },
  pt: {
    codeSent: 'Código de verificação enviado para o seu WhatsApp. Verifique suas mensagens!',
    connected: (date: string) => `Conectado desde ${date}`,
    connectedSimple: 'Conectado',
    active: 'Ativo',
    disconnect: 'Desconectar',
    disconnectConfirm: 'Desconectar seu número de WhatsApp do Balys?',
    disconnected: 'WhatsApp desconectado.',
    whatsappConnected: 'WhatsApp conectado! Agora você pode conversar com o Balys pelo WhatsApp.',
    enterCode: 'Enviamos um código de 6 dígitos para o seu WhatsApp. Digite abaixo para ativar o Balys.',
    codeLabel: 'Código de 6 dígitos',
    verify: 'Verificar',
    useDifferentNumber: 'Usar um número diferente',
    enterNumber: 'Digite seu número do WhatsApp no formato internacional (ex: +5511999999999).',
    willSendFrom: (phone: string) => ` O Balys enviará um código de verificação de ${phone}.`,
    numberLabel: 'Número do WhatsApp',
    sendCode: 'Enviar código de verificação',
    footerNote: 'Uma vez verificado, envie qualquer mensagem ao Balys pelo WhatsApp — texto, imagem ou nota de voz — e o Balys responderá com seu contexto e ferramentas completos.',
    balysMessages: 'Mensagens do Balys',
    balysMessagesCaption: 'Este número pode receber e responder conversas com o Balys.',
    reminders: 'Lembretes',
    remindersCaption: 'Use este número de WhatsApp para notificações de lembrete.',
    defaultReminderChannel: 'Canal padrão de lembretes',
    defaultReminderChannelCaption: 'O Balys escolherá WhatsApp quando nenhum canal de lembrete for especificado.',
    settingsSaved: 'Configurações do canal salvas.',
  },
};

export default function WhatsAppChannelPanel() {
  const [channel, setChannel]     = useState<Channel | null>(null);
  const [loading, setLoading]     = useState(true);
  const [phone, setPhone]         = useState('');
  const [code, setCode]           = useState('');
  const [step, setStep]           = useState<'idle' | 'sent' | 'active'>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uiLang, setUiLang]       = useState<UiLang>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => { if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = STRINGS[uiLang];

  const fetchChannel = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/channel');
      const data = await res.json();
      if (data?.channel) {
        setChannel(data.channel);
        setStep(data.channel.status === 'active' ? 'active' : 'sent');
      } else {
        setChannel(null);
        setStep('idle');
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannel(); }, [fetchChannel]);

  const handleRegister = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res  = await fetch('/api/whatsapp/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to send code');
      setStep('sent');
      setSuccess(t.codeSent);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res  = await fetch('/api/whatsapp/channel/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Verification failed');
      setSuccess(t.whatsappConnected);
      setStep('active');
      fetchChannel();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t.disconnectConfirm)) return;
    setError(null);
    setSaving(true);
    try {
      await fetch('/api/whatsapp/channel', { method: 'DELETE' });
      setChannel(null);
      setStep('idle');
      setPhone('');
      setCode('');
      setSuccess(t.disconnected);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateReminderSettings = async (patch: Pick<Channel, 'reminders_enabled' | 'is_default_reminder_channel'>) => {
    if (!channel) return;
    const previous = channel;
    const next = { ...channel, ...patch };
    setChannel(next);
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/channel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update channel settings');
      setSuccess(t.settingsSaved);
    } catch (e: unknown) {
      setChannel(previous);
      setError(e instanceof Error ? e.message : 'Failed to update channel settings');
    } finally {
      setSaving(false);
    }
  };

  const instancePhone = process.env.NEXT_PUBLIC_WHATSAPP_INSTANCE_DISPLAY_NUMBER ?? '';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  return (
    <Box>
      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {step === 'active' && channel ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleIcon color="success" />
              <Box>
                <Typography fontWeight={600}>+{channel.phone}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {channel.verified_at
                    ? t.connected(new Date(channel.verified_at).toLocaleDateString(intlLocale(uiLang)))
                    : t.connectedSimple}
                </Typography>
              </Box>
              <Chip icon={<WhatsAppIcon />} label={t.active} color="success" size="small" variant="outlined" />
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDisconnect}
              disabled={saving}
            >
              {t.disconnect}
            </Button>
          </Box>
          <Divider />
          <Stack spacing={1}>
            <Box>
              <FormControlLabel
                control={<Switch checked disabled />}
                label={t.balysMessages}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
                {t.balysMessagesCaption}
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={channel.reminders_enabled !== false}
                    onChange={e => updateReminderSettings({
                      reminders_enabled: e.target.checked,
                      is_default_reminder_channel: e.target.checked ? channel.is_default_reminder_channel !== false : false,
                    })}
                    disabled={saving}
                  />
                }
                label={t.reminders}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
                {t.remindersCaption}
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={channel.reminders_enabled !== false && channel.is_default_reminder_channel !== false}
                    onChange={e => updateReminderSettings({
                      reminders_enabled: e.target.checked ? true : channel.reminders_enabled !== false,
                      is_default_reminder_channel: e.target.checked,
                    })}
                    disabled={saving || channel.reminders_enabled === false}
                  />
                }
                label={t.defaultReminderChannel}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
                {t.defaultReminderChannelCaption}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      ) : step === 'sent' ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t.enterCode}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label={t.codeLabel}
              size="small"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              sx={{ width: 160 }}
            />
            <Button variant="contained" onClick={handleVerify} disabled={saving || code.length !== 6}>
              {saving ? <CircularProgress size={18} /> : t.verify}
            </Button>
            <Button variant="text" size="small" onClick={() => { setStep('idle'); setCode(''); }}>
              {t.useDifferentNumber}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t.enterNumber}
            {instancePhone && (
              <strong>{t.willSendFrom(instancePhone)}</strong>
            )}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label={t.numberLabel}
              size="small"
              placeholder="+5511999999999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              sx={{ width: 240 }}
            />
            <Button
              variant="contained"
              startIcon={<WhatsAppIcon />}
              onClick={handleRegister}
              disabled={saving || !phone.trim()}
            >
              {saving ? <CircularProgress size={18} /> : t.sendCode}
            </Button>
          </Stack>
        </Box>
      )}

      {step !== 'active' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            {t.footerNote}
          </Typography>
        </>
      )}
    </Box>
  );
}
