'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel, FormLabel, MenuItem, Paper, Radio, RadioGroup, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSearchParams } from 'next/navigation';
import { resolveUiLang, type UiLang } from '@/lib/i18n';
import { SUPPORT_UI } from '@/lib/support/ui-copy';
import type { FunnelAction } from '@/lib/support/cancellation-funnel';

type Message = { role: 'user' | 'assistant'; content: string };
type SupportRequest = { id: string; status: string; created_at: string; provider_action_status?: string };

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<UiLang>('en');
  const copy = SUPPORT_UI[lang];
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US';
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [nextActions, setNextActions] = useState<FunnelAction[]>([]);
  const [funnelSessionId, setFunnelSessionId] = useState<string | null>(null);
  const [formAvailable, setFormAvailable] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [billing, setBilling] = useState<{ plan_code?: string; billing_state?: string; provider?: string | null } | null>(null);
  const [reasonCode, setReasonCode] = useState<keyof typeof copy.reasons>('other');
  const [reason, setReason] = useState('');
  const [disappointing, setDisappointing] = useState('');
  const [expectation, setExpectation] = useState('');
  const [secondChance, setSecondChance] = useState<'yes' | 'no'>('yes');
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const intentStarted = useRef(false);

  const localizeError = (code?: string) => copy.errors[code as keyof typeof copy.errors] || copy.errors.SUPPORT_UNAVAILABLE;
  const valid = reason.trim().length >= 100 && disappointing.trim().length >= 10 && expectation.trim().length >= 10;

  const loadRequests = async () => {
    const response = await fetch('/api/support/requests');
    const data = await response.json();
    if (data.ok) setRequests(data.requests || []);
  };

  useEffect(() => {
    const stored = resolveUiLang(localStorage.getItem('ui_language'));
    setLang(stored);
    const onStorage = (event: StorageEvent) => { if (event.key === 'ui_language') setLang(resolveUiLang(event.newValue)); };
    window.addEventListener('storage', onStorage);
    void loadRequests();
    fetch('/api/billing/entitlements').then(response => response.json()).then(data => {
      if (data.ok) setBilling({ ...(data.entitlements || {}), provider: data.billing?.provider || null });
    }).catch(() => setError(SUPPORT_UI[stored].errors.SUPPORT_UNAVAILABLE));
    const draft = localStorage.getItem('support_cancellation_draft_v2');
    if (draft) {
      try {
        const value = JSON.parse(draft) as Record<string, string>;
        setReasonCode((value.reasonCode || 'other') as keyof typeof copy.reasons); setReason(value.reason || '');
        setDisappointing(value.disappointing || ''); setExpectation(value.expectation || ''); setSecondChance(value.secondChance === 'no' ? 'no' : 'yes');
      } catch { localStorage.removeItem('support_cancellation_draft_v2'); }
    }
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem('support_cancellation_draft_v2', JSON.stringify({ reasonCode, reason, disappointing, expectation, secondChance }));
  }, [reasonCode, reason, disappointing, expectation, secondChance]);

  useEffect(() => {
    conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loadingAction]);

  const send = async (options: { message?: string; questionKey?: FunnelAction; label?: string }) => {
    const label = options.label || options.message || '';
    if (!label.trim() || loadingAction) return;
    setSelected(options.questionKey || label); setLoadingAction(options.questionKey || label); setError(null);
    setMessages(current => [...current, { role: 'user', content: label }]); setChatInput('');
    try {
      const response = await fetch('/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: options.message || null, question_key: options.questionKey || null, locale, funnel_session_id: funnelSessionId }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.code || 'SUPPORT_UNAVAILABLE');
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
      setNextActions(data.next_actions || []); setFunnelSessionId(data.funnel_session_id || funnelSessionId); setFormAvailable(Boolean(data.cancellation_form_available));
    } catch (requestError: unknown) {
      setError(localizeError(requestError instanceof Error ? requestError.message : undefined));
    } finally { setLoadingAction(null); }
  };

  useEffect(() => {
    if (searchParams.get('intent') === 'cancel_subscription' && !intentStarted.current) {
      intentStarted.current = true;
      void send({ questionKey: 'manage_subscription', label: copy.actions.manage_subscription });
    }
  }, [searchParams, copy.actions.manage_subscription]);

  const submit = async () => {
    if (!valid || !funnelSessionId) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch('/api/support/cancellation-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        reason_code: reasonCode, reason, disappointing_features: disappointing, unmet_expectation: expectation,
        would_accept_human_support: secondChance === 'yes', source: searchParams.get('source') === 'billing_page' ? 'billing_page' : 'support_balys', locale, funnel_session_id: funnelSessionId,
      }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.code || 'CANCELLATION_CREATE_FAILED');
      setSuccess(copy.success); setReviewing(false); setFormAvailable(false); localStorage.removeItem('support_cancellation_draft_v2'); await loadRequests();
    } catch (requestError: unknown) { setError(localizeError(requestError instanceof Error ? requestError.message : undefined)); }
    finally { setSaving(false); }
  };

  return <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 920, mx: 'auto', width: '100%' }}>
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}><SupportAgentIcon color="primary" /><Typography variant="h4" fontWeight={800}>{copy.title}</Typography></Box>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{copy.subtitle}</Typography>
    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography variant="h6" fontWeight={750}>{copy.balys}</Typography><Chip size="small" label={`${billing?.plan_code?.toUpperCase() || 'FREE'} · ${billing?.billing_state || 'free'}`} /></Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{copy.intro}</Typography>
      {messages.length > 0 && <Box ref={conversationRef} aria-live="polite" sx={{ display: 'grid', gap: 1.25, my: 2, maxHeight: 380, overflowY: 'auto' }}>{messages.map((message, index) => <Box key={`${message.role}-${index}`} sx={{ p: 1.5, maxWidth: '88%', ml: message.role === 'user' ? 'auto' : 0, bgcolor: message.role === 'user' ? 'primary.dark' : 'action.hover', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">{message.role === 'user' ? (lang === 'pt' ? 'Você' : 'You') : 'Balys'}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography></Box>)}</Box>}
      {loadingAction && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">{copy.thinking}</Typography></Box>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 2 }}>{copy.quick.map(([key, label]) => <Chip key={key} label={label} clickable disabled={Boolean(loadingAction)} color={selected === key ? 'primary' : 'default'} variant={selected === key ? 'filled' : 'outlined'} onClick={() => key === 'manage_subscription' ? void send({ questionKey: key, label }) : void send({ message: label })} />)}</Box>
      {nextActions.length > 0 && <Alert severity="info" sx={{ my: 2 }} action={nextActions.map(action => <Button key={action} color="inherit" onClick={() => void send({ questionKey: action, label: copy.actions[action] })}>{copy.actions[action]}</Button>)}>{lang === 'pt' ? 'Próxima etapa da gestão da assinatura' : 'Next subscription management step'}</Alert>}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}><TextField fullWidth label={copy.prompt} value={chatInput} onChange={event => setChatInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send({ message: chatInput }); } }} multiline maxRows={4} /><Button variant="contained" aria-label={copy.send} disabled={!chatInput.trim() || Boolean(loadingAction)} onClick={() => void send({ message: chatInput })} sx={{ minWidth: 48, minHeight: 48 }}><SendIcon /></Button></Box>
    </Paper>

    {formAvailable && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 3 }}>
      <Typography variant="h6" fontWeight={750}>{copy.formTitle}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>{copy.formIntro}</Typography>
      <Stepper activeStep={reviewing ? 1 : 0} sx={{ mb: 3 }}><Step><StepLabel>{lang === 'pt' ? 'Detalhes' : 'Details'}</StepLabel></Step><Step><StepLabel>{lang === 'pt' ? 'Revisão' : 'Review'}</StepLabel></Step></Stepper>
      {!reviewing ? <>
        <TextField select fullWidth label={copy.reasonCode} value={reasonCode} onChange={event => setReasonCode(event.target.value as keyof typeof copy.reasons)} sx={{ mb: 2 }}>{Object.entries(copy.reasons).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
        <TextField fullWidth multiline minRows={4} label={copy.reason} value={reason} onChange={event => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 100} helperText={`${reason.trim().length}/100`} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={2} label={copy.disappointing} value={disappointing} onChange={event => setDisappointing(event.target.value)} error={disappointing.length > 0 && disappointing.trim().length < 10} helperText={`${disappointing.trim().length}/10`} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={2} label={copy.expectation} value={expectation} onChange={event => setExpectation(event.target.value)} error={expectation.length > 0 && expectation.trim().length < 10} helperText={`${expectation.trim().length}/10`} sx={{ mb: 2 }} />
        <FormControl><FormLabel>{copy.secondChance}</FormLabel><RadioGroup row value={secondChance} onChange={event => setSecondChance(event.target.value as 'yes' | 'no')}><FormControlLabel value="yes" control={<Radio />} label={copy.yes} /><FormControlLabel value="no" control={<Radio />} label={copy.no} /></RadioGroup></FormControl>
        <Box sx={{ mt: 2 }}><Button variant="contained" disabled={!valid} onClick={() => setReviewing(true)}>{copy.review}</Button></Box>
      </> : <>
        <Typography variant="subtitle1" fontWeight={700}>{copy.reviewTitle}</Typography>
        {[copy.reasons[reasonCode], reason, disappointing, expectation, secondChance === 'yes' ? copy.yes : copy.no].map((value, index) => <Paper key={index} variant="outlined" sx={{ p: 1.5, mt: 1.25 }}><Typography sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography></Paper>)}
        <Alert severity="warning" sx={{ mt: 2 }}>{copy.formIntro}</Alert>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}><Button onClick={() => setReviewing(false)}>{copy.edit}</Button><Button variant="contained" disabled={saving} onClick={() => void submit()}>{saving ? <CircularProgress size={18} /> : copy.submit}</Button></Box>
      </>}
    </Paper>}

    {requests.length > 0 && <Paper variant="outlined" sx={{ p: 2, mt: 3 }}><Typography fontWeight={700}>{copy.requests}</Typography>{requests.slice(0, 5).map(request => <Typography key={request.id} variant="body2" color="text.secondary" sx={{ mt: 1 }}>{new Intl.DateTimeFormat(locale).format(new Date(request.created_at))} · {copy.statuses[request.status as keyof typeof copy.statuses] || request.status}</Typography>)}</Paper>}
  </Box>;
}

export default function SupportPage() {
  return <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}><SupportPageContent /></Suspense>;
}
