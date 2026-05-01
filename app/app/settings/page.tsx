'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, IconButton, Switch, Divider, CircularProgress, Alert, Chip, Select, MenuItem, FormControl, InputLabel, Stack } from '@mui/material';
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

function SettingsPageContent() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aiLanguage, setAiLanguage] = useState('en');
  const [uiLanguage, setUiLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [spendCurrency, setSpendCurrency] = useState<'USD' | 'BRL'>('USD');
  const [spendDays, setSpendDays] = useState(30);
  const [spendLoading, setSpendLoading] = useState(false);
  const [spendError, setSpendError] = useState<string | null>(null);
  const [spendData, setSpendData] = useState<any | null>(null);
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

  const formatMoney = useCallback((usd: number, fx: number) => {
    if (spendCurrency === 'BRL') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((usd || 0) * fx);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd || 0);
  }, [spendCurrency]);

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

  const fetchSpend = useCallback(async () => {
    setSpendLoading(true);
    setSpendError(null);
    try {
      const res = await fetch(`/api/ai/spend?days=${spendDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load AI spend');
      setSpendData(data);
    } catch (err: any) {
      setSpendError(err.message || 'Failed to load AI spend');
    } finally {
      setSpendLoading(false);
    }
  }, [spendDays]);

  useEffect(() => {
    fetchAccounts();
    setAiLanguage(localStorage.getItem('balysai_language') || 'en');
    setUiLanguage(localStorage.getItem('ui_language') || 'en');
    setSpendCurrency((localStorage.getItem('spend_currency') as 'USD' | 'BRL') || 'USD');
  }, [fetchAccounts]);

  useEffect(() => {
    fetchSpend();
  }, [fetchSpend]);

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

      {/* AI Spend */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">AI Spend & Tokens</Typography>
            <Typography variant="body2" color="text.secondary">
              Usage for your Flow Me account, grouped by model and linked Google account
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={spendCurrency}
                label="Currency"
                onChange={e => {
                  const value = e.target.value as 'USD' | 'BRL';
                  setSpendCurrency(value);
                  localStorage.setItem('spend_currency', value);
                }}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="BRL">BRL</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Window</InputLabel>
              <Select
                value={String(spendDays)}
                label="Window"
                onChange={e => setSpendDays(Number(e.target.value))}
              >
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={fetchSpend}>Refresh</Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {spendError && <Alert severity="error" sx={{ mb: 2 }}>{spendError}</Alert>}

        {spendLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Total cost</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {formatMoney(spendData?.total?.cost_usd || 0, spendData?.fx_usd_brl || 5)}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Total tokens</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {Number(spendData?.total?.total_tokens || 0).toLocaleString()}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Requests</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {Number(spendData?.rows_count || 0).toLocaleString()}
                </Typography>
              </Paper>
            </Stack>

            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>By model</Typography>
            {spendData?.by_model?.length ? (
              <List sx={{ p: 0 }}>
                {spendData.by_model.map((row: any, idx: number) => (
                  <React.Fragment key={`${row.provider}:${row.model}`}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography fontWeight={600}>{row.model}</Typography>
                            <Chip size="small" label={row.provider} color={row.provider === 'gemini' ? 'success' : 'primary'} />
                            <Chip size="small" label={`${Number(row.total_tokens || 0).toLocaleString()} tokens`} variant="outlined" />
                          </Box>
                        }
                        secondary={`${row.requests} requests`}
                      />
                      <Typography fontWeight={700}>
                        {formatMoney(row.cost_usd || 0, spendData?.fx_usd_brl || 5)}
                      </Typography>
                    </ListItem>
                    {idx < spendData.by_model.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No usage yet for selected window.</Typography>
            )}

            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>By Google account</Typography>
            {spendData?.by_account?.length ? (
              <List sx={{ p: 0 }}>
                {spendData.by_account.map((row: any, idx: number) => (
                  <React.Fragment key={row.linked_account_id || 'unlinked'}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={<Typography fontWeight={600}>{row.account_name}</Typography>}
                        secondary={`${row.requests} requests • ${Number(row.total_tokens || 0).toLocaleString()} tokens`}
                      />
                      <Typography fontWeight={700}>
                        {formatMoney(row.cost_usd || 0, spendData?.fx_usd_brl || 5)}
                      </Typography>
                    </ListItem>
                    {idx < spendData.by_account.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No account-level usage yet.</Typography>
            )}
          </Box>
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
