'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, IconButton, Switch, Divider, CircularProgress, Alert, Chip, Select, MenuItem, FormControl, InputLabel, TextField } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import GoogleIcon from '@mui/icons-material/Google';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import LinkAccountModal from '@/components/calendar/LinkAccountModal';
import WhatsAppChannelPanel from '@/components/settings/WhatsAppChannelPanel';
import RemindersPanel from '@/components/settings/RemindersPanel';
import { useSearchParams } from 'next/navigation';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';

const UI_LANGUAGES: { code: UiLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

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

const FINANCE_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN'];

type BillingInfo = {
  provider: 'stripe' | 'apple' | 'google' | null;
  state: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  management_surface: 'stripe' | 'apple' | 'google' | 'none';
};

type EntitlementsInfo = {
  plan_code: 'free' | 'pro';
  has_pro: boolean;
  ai_credits?: {
    label?: string;
  };
};

type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  currency: string;
  amount_paid: number;
  amount_due: number;
  created: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

function billingProviderLabel(provider: BillingInfo['provider']) {
  if (provider === 'stripe') return 'Stripe';
  if (provider === 'apple') return 'App Store';
  if (provider === 'google') return 'Google Play';
  return 'Flow Me';
}

function billingStatusColor(state: string): 'default' | 'success' | 'warning' | 'error' {
  if (state === 'active' || state === 'trialing') return 'success';
  if (state === 'past_due' || state === 'grace_period' || state === 'incomplete') return 'warning';
  if (state === 'canceled' || state === 'expired' || state === 'account_hold') return 'error';
  return 'default';
}

function formatPeriodEnd(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function SettingsPageContent() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aiLanguage, setAiLanguage] = useState('en');
  const [uiLanguage, setUiLanguage] = useState<UiLang>('en');
  const [councilMode, setCouncilMode] = useState<'cheap' | 'best'>('cheap');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('BRL');
  const [monthlyReviewTime, setMonthlyReviewTime] = useState('18:30');
  const [financeSaving, setFinanceSaving] = useState(false);
  const [aiBehaviorSaving, setAiBehaviorSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingAction, setBillingAction] = useState<'monthly' | 'annual' | 'payment' | 'invoices' | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsInfo | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const searchParams = useSearchParams();

  const t = UI[uiLanguage].settings;

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLanguage(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ui_language') setUiLanguage(resolveUiLang(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const googleConnected = searchParams.get('google_connected');
    const googleError = searchParams.get('google_error');
    const billingStatus = searchParams.get('billing');

    if (googleConnected) {
      setSuccess(t.googleConnectedSuccess);
      window.history.replaceState({}, '', '/app/settings');
    }
    if (googleError) {
      const msg = t.oauthErrors[googleError as keyof typeof t.oauthErrors] || `Google OAuth error: ${googleError}`;
      setError(msg);
      window.history.replaceState({}, '', '/app/settings');
    }
    if (billingStatus === 'success') {
      setSuccess('Assinatura iniciada. O acesso Pro será atualizado assim que a confirmação do pagamento chegar.');
      window.history.replaceState({}, '', '/app/settings');
    }
    if (billingStatus === 'cancelled') {
      setError('Checkout cancelado. Você pode tentar novamente quando quiser.');
      window.history.replaceState({}, '', '/app/settings');
    }
    if (billingStatus === 'portal_return') {
      setSuccess('Assinatura atualizada.');
      window.history.replaceState({}, '', '/app/settings');
    }
  }, [searchParams, t]);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/linked-accounts?surface=calendar');
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

    fetch('/api/ai/settings')
      .then(r => r.json())
      .then(d => {
        if (d?.ok) {
          setCouncilMode((d.council_mode as 'cheap' | 'best') || 'cheap');
          setMemoryEnabled(d.memory_enabled ?? true);
        }
      })
      .catch(() => { /* ignore — keeps defaults */ });

    fetch('/api/finance/profile')
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.profile?.default_currency) setDefaultCurrency(d.profile.default_currency);
      })
      .catch(() => { /* ignore — keeps defaults */ });

    fetch('/api/briefings/preferences')
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.preferences?.monthly_review_time) setMonthlyReviewTime(d.preferences.monthly_review_time);
      })
      .catch(() => { /* ignore — keeps defaults */ });
  }, [fetchAccounts]);

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing/entitlements');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to fetch billing');
      setEntitlements(data.entitlements);
      setBilling(data.billing);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const startCheckout = useCallback(async (interval: 'monthly' | 'annual') => {
    setBillingAction(interval);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setBillingAction(null);
    }
  }, []);

  const openPaymentUpdate = useCallback(async () => {
    setBillingAction('payment');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to open payment update');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setBillingAction(null);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setBillingAction('invoices');
    try {
      const res = await fetch('/api/billing/invoices');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load invoices');
      setInvoices(data.invoices || []);
      setShowInvoices(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBillingAction(null);
    }
  }, []);

  const requestCancellation = useCallback(() => {
    window.location.href = '/app/support?intent=cancel_subscription&source=billing_page';
  }, []);

  const updateFinanceProfile = useCallback(async (currency: string) => {
    setFinanceSaving(true);
    try {
      const res = await fetch('/api/finance/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: currency }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save finance settings');
      setSuccess(t.financeSaved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFinanceSaving(false);
    }
  }, [t]);

  const updateMonthlyReviewTime = useCallback(async (time: string) => {
    setFinanceSaving(true);
    try {
      const res = await fetch('/api/briefings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_review_enabled: true, monthly_review_time: time }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save monthly review settings');
      setSuccess(t.financeSaved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFinanceSaving(false);
    }
  }, [t]);

  const updateAiBehavior = useCallback(async (patch: Partial<{ council_mode: 'cheap' | 'best'; memory_enabled: boolean }>) => {
    setAiBehaviorSaving(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save AI settings');
      setSuccess(t.aiSettingsSaved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiBehaviorSaving(false);
    }
  }, [t]);

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
    if (!confirm(t.deleteAccountConfirm)) return;
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
    window.location.href = `/api/auth/google/connect?linked_account_id=${accountId}`;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto', width: '100%', overflowY: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {t.title}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Billing */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Assinatura</Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie o acesso Pro, cobrança e créditos de IA.
            </Typography>
          </Box>
          {billingLoading ? (
            <CircularProgress size={20} />
          ) : (
            <Chip
              icon={entitlements?.has_pro ? <WorkspacePremiumIcon /> : <CreditCardIcon />}
              label={entitlements?.has_pro ? 'Pro ativo' : 'Free'}
              color={entitlements?.has_pro ? 'success' : 'default'}
              variant={entitlements?.has_pro ? 'filled' : 'outlined'}
            />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={700}>Plano atual</Typography>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>
              {entitlements?.has_pro ? 'Pro' : 'Free'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {entitlements?.ai_credits?.label || '10 créditos de IA por dia'}
            </Typography>
            {billing && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                <Chip size="small" label={billing.state} color={billingStatusColor(billing.state)} variant="outlined" />
                <Chip size="small" label={billingProviderLabel(billing.provider)} variant="outlined" />
              </Box>
            )}
            {billing?.current_period_end && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {billing.cancel_at_period_end ? 'Acesso até ' : 'Próxima renovação em '}
                {formatPeriodEnd(billing.current_period_end)}
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={700}>Pro</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Tudo do Flow Me, IA ilimitada, finanças, reviews, conectores, WhatsApp, lembretes, reuniões e imagens.
            </Typography>

            {billing?.management_surface === 'apple' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Sua assinatura é gerenciada pela App Store.
              </Alert>
            )}
            {billing?.management_surface === 'google' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Sua assinatura é gerenciada pelo Google Play.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              {!entitlements?.has_pro && (
                <>
                  <Button
                    variant="contained"
                    startIcon={billingAction === 'monthly' ? <CircularProgress size={16} color="inherit" /> : <CreditCardIcon />}
                    onClick={() => startCheckout('monthly')}
                    disabled={Boolean(billingAction)}
                  >
                    R$59,90/mês
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={billingAction === 'annual' ? <CircularProgress size={16} color="inherit" /> : <CreditCardIcon />}
                    onClick={() => startCheckout('annual')}
                    disabled={Boolean(billingAction)}
                  >
                    R$39,90/mês no anual
                  </Button>
                </>
              )}
              {billing?.management_surface === 'stripe' && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={billingAction === 'payment' ? <CircularProgress size={16} color="inherit" /> : <CreditCardIcon />}
                    onClick={openPaymentUpdate}
                    disabled={Boolean(billingAction)}
                  >
                    Atualizar pagamento
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={billingAction === 'invoices' ? <CircularProgress size={16} color="inherit" /> : <ReceiptLongIcon />}
                    onClick={loadInvoices}
                    disabled={Boolean(billingAction)}
                  >
                    Ver faturas
                  </Button>
                  <Button
                    variant="text"
                    color="warning"
                    startIcon={<SupportAgentIcon />}
                    onClick={requestCancellation}
                    disabled={Boolean(billingAction)}
                  >
                    Solicitar cancelamento
                  </Button>
                </>
              )}
            </Box>

            {showInvoices && billing?.management_surface === 'stripe' && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Faturas recentes</Typography>
                {invoices.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Nenhuma fatura encontrada ainda.</Typography>
                ) : (
                  <List dense disablePadding>
                    {invoices.map(invoice => (
                      <ListItem
                        key={invoice.id}
                        disableGutters
                        secondaryAction={
                          invoice.hosted_invoice_url ? (
                            <IconButton edge="end" href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer" aria-label="Abrir fatura">
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          ) : null
                        }
                      >
                        <ListItemText
                          primary={invoice.number || invoice.id}
                          secondary={`${invoice.status || 'invoice'} • ${(invoice.amount_paid / 100).toLocaleString('pt-BR', { style: 'currency', currency: invoice.currency || 'BRL' })}${invoice.created ? ` • ${formatPeriodEnd(invoice.created)}` : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      </Paper>

      {/* Linked Calendars */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{t.linkedCalendars}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t.linkedCalendarsDesc}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setLinkModalOpen(true)}
          >
            {t.addAccount}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : accounts.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
            {t.noAccountsLinked}
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
                        {acc.is_active ? t.active : t.inactive}
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
                            label={t.connected}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            icon={<LinkOffIcon />}
                            label={t.notConnected}
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
                          {t.provider}: {acc.provider}
                        </Typography>
                        {!acc.google_connected && (
                          <Button
                            size="small"
                            startIcon={<GoogleIcon />}
                            onClick={() => handleConnectGoogle(acc.id)}
                            sx={{ ml: 2, textTransform: 'none' }}
                          >
                            {t.connectGoogle}
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

      {/* AI Behavior */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{t.aiBehavior}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t.aiBehaviorDesc}
            </Typography>
          </Box>
          {aiBehaviorSaving && <CircularProgress size={18} />}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>{t.councilMode}</Typography>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>{t.councilMode}</InputLabel>
              <Select
                value={councilMode}
                label={t.councilMode}
                onChange={e => {
                  const v = e.target.value as 'cheap' | 'best';
                  setCouncilMode(v);
                  updateAiBehavior({ council_mode: v });
                }}
              >
                <MenuItem value="cheap">{t.councilModeCheap}</MenuItem>
                <MenuItem value="best">{t.councilModeBest}</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t.councilModeCaption}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          <Box sx={{ minWidth: 240 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>{t.crossThreadMemory}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={memoryEnabled}
                onChange={e => {
                  setMemoryEnabled(e.target.checked);
                  updateAiBehavior({ memory_enabled: e.target.checked });
                }}
                color="success"
              />
              <Typography variant="body2">{memoryEnabled ? t.memoryOn : t.memoryOff}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t.memoryCaption}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Finance */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{t.finance}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t.financeDesc}
            </Typography>
          </Box>
          {financeSaving && <CircularProgress size={18} />}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t.defaultCurrency}</InputLabel>
            <Select
              value={defaultCurrency}
              label={t.defaultCurrency}
              onChange={e => {
                const currency = e.target.value;
                setDefaultCurrency(currency);
                updateFinanceProfile(currency);
              }}
            >
              {FINANCE_CURRENCIES.map(currency => (
                <MenuItem key={currency} value={currency}>{currency}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <TextField
              type="time"
              size="small"
              label={t.monthlyReviewTime}
              value={monthlyReviewTime}
              onChange={e => {
                setMonthlyReviewTime(e.target.value);
                updateMonthlyReviewTime(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {t.monthlyReviewDesc}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Language Settings */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>{t.language}</Typography>

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/* UI Language — EN and PT only */}
          <Box>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>{t.uiLanguage}</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t.interfaceLanguage}</InputLabel>
              <Select
                value={uiLanguage}
                label={t.interfaceLanguage}
                onChange={e => {
                  const v = e.target.value as UiLang;
                  setUiLanguage(v);
                  localStorage.setItem('ui_language', v);
                  window.dispatchEvent(new StorageEvent('storage', { key: 'ui_language', newValue: v }));
                }}
              >
                {UI_LANGUAGES.map(l => (
                  <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t.uiLanguageCaption}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* AI Language — all languages */}
          <Box>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>{t.aiLanguage}</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t.aiLanguageLabel}</InputLabel>
              <Select
                value={aiLanguage}
                label={t.aiLanguageLabel}
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
              {t.aiLanguageCaption}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Channels */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WhatsAppIcon sx={{ color: '#25D366' }} />
          <Typography variant="h6" fontWeight="bold">{t.channels}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t.channelsDesc}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>{t.whatsapp}</Typography>
        <WhatsAppChannelPanel />
        <Divider sx={{ my: 3 }} />
        <RemindersPanel />
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
