'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Chip, CircularProgress,
  Alert, Divider, Stack,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';

type ChannelStatus = 'none' | 'pending_verification' | 'active';

interface Channel {
  id: string;
  phone: string;
  status: ChannelStatus;
  verified_at: string | null;
}

export default function WhatsAppChannelPanel() {
  const [channel, setChannel]     = useState<Channel | null>(null);
  const [loading, setLoading]     = useState(true);
  const [phone, setPhone]         = useState('');
  const [code, setCode]           = useState('');
  const [step, setStep]           = useState<'idle' | 'sent' | 'active'>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

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
      setSuccess('Verification code sent to your WhatsApp. Check your messages!');
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
      setSuccess('WhatsApp connected! You can now chat with Balys on WhatsApp.');
      setStep('active');
      fetchChannel();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your WhatsApp number from Balys?')) return;
    setError(null);
    setSaving(true);
    try {
      await fetch('/api/whatsapp/channel', { method: 'DELETE' });
      setChannel(null);
      setStep('idle');
      setPhone('');
      setCode('');
      setSuccess('WhatsApp disconnected.');
    } catch (e: any) {
      setError(e.message);
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckCircleIcon color="success" />
            <Box>
              <Typography fontWeight={600}>+{channel.phone}</Typography>
              <Typography variant="caption" color="text.secondary">
                Connected{channel.verified_at ? ` since ${new Date(channel.verified_at).toLocaleDateString()}` : ''}
              </Typography>
            </Box>
            <Chip icon={<WhatsAppIcon />} label="Active" color="success" size="small" variant="outlined" />
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleDisconnect}
            disabled={saving}
          >
            Disconnect
          </Button>
        </Box>
      ) : step === 'sent' ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We sent a 6-digit code to your WhatsApp. Enter it below to activate Balys.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label="6-digit code"
              size="small"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              sx={{ width: 160 }}
            />
            <Button variant="contained" onClick={handleVerify} disabled={saving || code.length !== 6}>
              {saving ? <CircularProgress size={18} /> : 'Verify'}
            </Button>
            <Button variant="text" size="small" onClick={() => { setStep('idle'); setCode(''); }}>
              Use a different number
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your WhatsApp number in international format (e.g. +5511999999999).
            {instancePhone && (
              <> Balys will send a verification code from <strong>{instancePhone}</strong>.</>
            )}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label="WhatsApp number"
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
              {saving ? <CircularProgress size={18} /> : 'Send verification code'}
            </Button>
          </Stack>
        </Box>
      )}

      {step !== 'active' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Once verified, send any message to Balys on WhatsApp — text, image, or voice note — and Balys will reply with your full context and tools.
          </Typography>
        </>
      )}
    </Box>
  );
}
