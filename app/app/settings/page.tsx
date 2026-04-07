'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, IconButton, Switch, Divider, CircularProgress, Alert, Chip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import GoogleIcon from '@mui/icons-material/Google';
import LinkAccountModal from '@/components/calendar/LinkAccountModal';
import { useSearchParams } from 'next/navigation';

const AI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aiLanguage, setAiLanguage] = useState('en');
  const [uiLanguage, setUiLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const searchParams = useSearchParams();

  // Check for OAuth callback results in URL params
  useEffect(() => {
    const googleConnected = searchParams.get('google_connected');
    const googleError = searchParams.get('google_error');

    if (googleConnected) {
      setSuccess('Google Calendar connected successfully!');
      // Clean up the URL
      window.history.replaceState({}, '', '/app/settings');
    }
    if (googleError) {
      const errorMessages: Record<string, string> = {
        access_denied: 'You denied Google Calendar access. The account was created but is not connected.',
        missing_params: 'OAuth callback had missing parameters. Please try again.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        unauthorized: 'Session expired. Please log in and try again.',
        account_not_found: 'Linked account not found. It may have been deleted.',
        no_access_token: 'Google did not return an access token. Please try again.',
        token_store_failed: 'Failed to save Google tokens. Please try again.',
        internal: 'An unexpected error occurred. Please try again.',
      };
      setError(errorMessages[googleError] || `Google OAuth error: ${googleError}`);
      window.history.replaceState({}, '', '/app/settings');
    }
  }, [searchParams]);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/linked-accounts');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to fetch accounts');
      setAccounts(data.accounts || []);
      if (data.userEmail) setUserEmail(data.userEmail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    setAiLanguage(localStorage.getItem('balysai_language') || 'en');
    setUiLanguage(localStorage.getItem('ui_language') || 'en');
  }, [fetchAccounts]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/linked-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update account');
      fetchAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this linked account? This will also remove its Google Calendar connection.')) return;
    try {
      const res = await fetch(`/api/linked-accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to delete account');
      fetchAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConnectGoogle = (accountId: string) => {
    // Redirect to Google OAuth flow for this account
    window.location.href = `/api/auth/google/connect?linked_account_id=${accountId}`;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto', width: '100%', overflowY: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Settings
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Linked Calendars</Typography>
            <Typography variant="body2" color="text.secondary">
              Connect Google Calendar accounts to sync and create events
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setLinkModalOpen(true)}
          >
            Add Account
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : accounts.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
            No accounts linked yet. Click "Add Account" to connect a Google Calendar.
          </Typography>
        ) : (
          <List>
            {accounts.map((acc, index) => (
              <React.Fragment key={acc.id}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color={acc.is_active ? 'success.main' : 'text.disabled'}>
                        {acc.is_active ? 'Active' : 'Inactive'}
                      </Typography>
                      <Switch 
                        edge="end" 
                        checked={acc.is_active} 
                        onChange={() => handleToggleActive(acc.id, acc.is_active)} 
                        color="success"
                      />
                      {acc.name !== userEmail && (
                        <IconButton edge="end" onClick={() => handleDelete(acc.id)} color="error" sx={{ ml: 1 }}>
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Box>
                  }
                  sx={{ py: 2 }}
                >
                  <ListItemText
                    primary={
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                           <Typography fontWeight="bold">{acc.name}</Typography>
                           <Chip label={acc.type} size="small" variant="outlined" color={acc.type === 'work' ? 'secondary' : 'primary'} />
                           {acc.google_connected ? (
                             <Chip 
                               icon={<LinkIcon />} 
                               label="Connected" 
                               size="small" 
                               color="success" 
                               variant="outlined" 
                             />
                           ) : (
                             <Chip 
                               icon={<LinkOffIcon />} 
                               label="Not connected" 
                               size="small" 
                               color="warning" 
                               variant="outlined" 
                               onClick={() => handleConnectGoogle(acc.id)}
                               sx={{ cursor: 'pointer' }}
                             />
                           )}
                       </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Provider: {acc.provider}
                        </Typography>
                        {!acc.google_connected && (
                          <Button
                            size="small"
                            startIcon={<GoogleIcon />}
                            onClick={() => handleConnectGoogle(acc.id)}
                            sx={{ ml: 2, textTransform: 'none' }}
                          >
                            Connect Google
                          </Button>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {index < accounts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Language Settings */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>Language</Typography>

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/* UI Language */}
          <Box>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>UI Language</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Interface Language</InputLabel>
              <Select
                value={uiLanguage}
                label="Interface Language"
                onChange={e => {
                  setUiLanguage(e.target.value);
                  localStorage.setItem('ui_language', e.target.value);
                }}
              >
                {AI_LANGUAGES.map(l => (
                  <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Language used for the app interface.
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* AI Language */}
          <Box>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>BalysAI Response Language</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>AI Language</InputLabel>
              <Select
                value={aiLanguage}
                label="AI Language"
                onChange={e => {
                  setAiLanguage(e.target.value);
                  localStorage.setItem('balysai_language', e.target.value);
                }}
              >
                {AI_LANGUAGES.map(l => (
                  <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Language BalysAI uses in all responses.
            </Typography>
          </Box>
        </Box>
      </Paper>

      <LinkAccountModal
        open={linkModalOpen} 
        onClose={() => setLinkModalOpen(false)} 
        onSuccess={fetchAccounts} 
      />
    </Box>
  );
}
