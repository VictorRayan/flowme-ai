import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress, Typography, Box } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { resolveUiLang, type UiLang } from '@/lib/i18n';

interface LinkAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STRINGS = {
  en: {
    title: 'Link Google Calendar',
    redirectNote: 'You will be redirected to Google to authorize calendar access after filling this form.',
    nicknameLabel: 'Account Nickname',
    nicknameHelper: 'e.g. My Work Google, Personal Gmail',
    typeLabel: 'Account Type',
    personal: 'Personal',
    work: 'Work',
    cancel: 'Cancel',
    connect: 'Connect with Google',
  },
  pt: {
    title: 'Vincular Google Calendar',
    redirectNote: 'Você será redirecionado ao Google para autorizar o acesso ao calendário após preencher este formulário.',
    nicknameLabel: 'Apelido da conta',
    nicknameHelper: 'ex: Meu Google do Trabalho, Gmail Pessoal',
    typeLabel: 'Tipo de conta',
    personal: 'Pessoal',
    work: 'Trabalho',
    cancel: 'Cancelar',
    connect: 'Conectar com Google',
  },
};

export default function LinkAccountModal({ open, onClose, onSuccess }: LinkAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'work' | 'personal'>('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uiLang, setUiLang] = useState<UiLang>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => { if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = STRINGS[uiLang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/linked-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to link account');
      }

      const accountId = data.account.id;
      window.location.href = `/api/auth/google/connect?linked_account_id=${accountId}`;

      setName('');
      setType('personal');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <GoogleIcon sx={{ color: '#4285F4' }} />
            <Typography variant="body2" color="text.secondary">
              {t.redirectNote}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            autoFocus
            margin="dense"
            label={t.nicknameLabel}
            type="text"
            fullWidth
            variant="outlined"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText={t.nicknameHelper}
            inputProps={{ minLength: 2 }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel id="account-type-label">{t.typeLabel}</InputLabel>
            <Select
              labelId="account-type-label"
              value={type}
              onChange={(e) => setType(e.target.value as 'work' | 'personal')}
              label={t.typeLabel}
            >
              <MenuItem value="personal">{t.personal}</MenuItem>
              <MenuItem value="work">{t.work}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
          >
            {t.connect}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
