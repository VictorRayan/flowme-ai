'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel, FormLabel, MenuItem, Paper, Radio, RadioGroup, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CableIcon from '@mui/icons-material/Cable';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useSearchParams } from 'next/navigation';
import { resolveUiLang, type UiLang } from '@/lib/i18n';
import { SUPPORT_UI } from '@/lib/support/ui-copy';
import type { FunnelAction } from '@/lib/support/cancellation-funnel';

type Message = { role: 'user' | 'assistant'; content: string; sources?: Array<{ key: string; title: string }> };
type SupportRequest = { id: string; type?: 'cancellation' | 'payment_problem'; status: string; created_at: string; provider_action_status?: string };

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
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
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
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loadingAction]);

  useEffect(() => {
    if (formAvailable) requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [formAvailable]);

  const send = async (options: { message?: string; questionKey?: FunnelAction; label?: string; key?: string }) => {
    const label = options.label || options.message || '';
    if (!label.trim() || loadingAction) return;
    const stableKey = options.key || options.questionKey || label;
    setSelected(stableKey); setLoadingAction(stableKey); setError(null);
    setMessages(current => [...current, { role: 'user', content: label }]); setChatInput('');
    try {
      const response = await fetch('/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: options.message || null, question_key: options.questionKey || null, locale, funnel_session_id: funnelSessionId }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.code || 'SUPPORT_UNAVAILABLE');
      setMessages(current => [...current, { role: 'assistant', content: data.answer, sources: data.sources || [] }]);
      setNextActions(data.next_actions || []); setFunnelSessionId(data.funnel_session_id || funnelSessionId); setFormAvailable(Boolean(data.cancellation_form_available));
      if (data.support_ticket) await loadRequests();
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

  const quickIcon = (key: string) => {
    if (key === 'payment_problem') return <CreditCardIcon sx={{ fontSize: 16 }} />;
    if (key === 'connectors') return <CableIcon sx={{ fontSize: 16 }} />;
    if (key === 'balys') return <AutoAwesomeIcon sx={{ fontSize: 16 }} />;
    return <HelpOutlineIcon sx={{ fontSize: 16 }} />;
  };

  return <Box sx={{
    p: { xs: 2, md: 4 },
    maxWidth: 980,
    mx: 'auto',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    pb: 8,
    background: 'radial-gradient(circle at 12% 0%, rgba(99,102,241,0.12), transparent 34%), radial-gradient(circle at 90% 18%, rgba(45,212,191,0.10), transparent 28%)',
  }}>
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}><SupportAgentIcon color="primary" /><Typography variant="h3" fontWeight={900} sx={{ letterSpacing: -0.8 }}>{copy.title}</Typography></Box>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{copy.subtitle}</Typography>
    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, borderColor: 'rgba(129,140,248,0.20)', background: 'linear-gradient(145deg, rgba(17,24,39,0.96), rgba(15,23,42,0.90))', boxShadow: '0 24px 70px rgba(0,0,0,0.24)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography variant="h6" fontWeight={750}>{copy.balys}</Typography><Chip size="small" label={`${billing?.plan_code?.toUpperCase() || 'FREE'} · ${billing?.billing_state || 'free'}`} /></Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{copy.intro}</Typography>
      {messages.length > 0 && <Box aria-live="polite" sx={{ display: 'grid', gap: 1.25, my: 2, maxHeight: { xs: '44vh', md: 440 }, overflowY: 'auto', pr: 0.5, scrollBehavior: 'smooth' }}>{messages.map((message, index) => <Box key={`${message.role}-${index}`} sx={{ p: 1.75, maxWidth: { xs: '96%', sm: '88%' }, ml: message.role === 'user' ? 'auto' : 0, bgcolor: message.role === 'user' ? 'primary.dark' : 'rgba(51,65,85,0.64)', border: message.role === 'assistant' ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(129,140,248,0.24)', borderRadius: 2.5 }}><Typography variant="caption" color="text.secondary">{message.role === 'user' ? (lang === 'pt' ? 'Você' : 'You') : 'Balys'}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{message.content}</Typography>{message.sources && message.sources.length > 0 && <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>{message.sources.map(source => <Chip key={source.key} size="small" variant="outlined" label={source.title} />)}</Box>}</Box>)}<Box ref={conversationEndRef} /></Box>}
      {loadingAction && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">{copy.thinking}</Typography></Box>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 2 }}>{copy.quick.map(([key, label]) => <Chip key={key} icon={quickIcon(key)} label={label} clickable disabled={Boolean(loadingAction)} color={selected === key ? 'primary' : 'default'} variant={selected === key ? 'filled' : 'outlined'} sx={{ height: 34, borderRadius: 999, '& .MuiChip-label': { px: 0.75 } }} onClick={() => key === 'manage_subscription' ? void send({ questionKey: key, label, key }) : void send({ message: label, key })} />)}</Box>
      {nextActions.length > 0 && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', my: 2, p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(129,140,248,0.22)' }}><Chip icon={<AutoAwesomeIcon />} label={lang === 'pt' ? 'Próxima etapa' : 'Next step'} color="primary" />{nextActions.map(action => <Button key={action} variant="contained" onClick={() => void send({ questionKey: action, label: copy.actions[action], key: action })}>{copy.actions[action]}</Button>)}</Box>}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}><TextField fullWidth label={copy.prompt} value={chatInput} onChange={event => setChatInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send({ message: chatInput }); } }} multiline maxRows={4} /><Button variant="contained" aria-label={copy.send} disabled={!chatInput.trim() || Boolean(loadingAction)} onClick={() => void send({ message: chatInput })} sx={{ minWidth: 48, minHeight: 48 }}><SendIcon /></Button></Box>
    </Paper>

    {formAvailable && <Paper ref={formRef} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mt: 3, borderColor: 'rgba(52,211,153,0.22)', background: 'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(20,83,45,0.12))', scrollMarginTop: { xs: 80, md: 24 } }}>
      <Typography variant="h6" fontWeight={750}>{copy.formTitle}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>{copy.formIntro}</Typography>
      <Stepper activeStep={reviewing ? 1 : 0} sx={{ mb: 3 }}><Step><StepLabel>{lang === 'pt' ? 'Detalhes' : 'Details'}</StepLabel></Step><Step><StepLabel>{lang === 'pt' ? 'Revisão' : 'Review'}</StepLabel></Step></Stepper>
      {!reviewing ? <>
        <TextField select fullWidth label={copy.reasonCode} value={reasonCode} onChange={event => setReasonCode(event.target.value as keyof typeof copy.reasons)} sx={{ mb: 2 }}>{Object.entries(copy.reasons).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
        <TextField fullWidth multiline minRows={4} label={copy.reason} value={reason} onChange={event => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 100} helperText={`${reason.trim().length}/100`} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={2} label={copy.disappointing} value={disappointing} onChange={event => setDisappointing(event.target.value)} error={disappointing.length > 0 && disappointing.trim().length < 10} helperText={`${disappointing.trim().length}/10`} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={2} label={copy.expectation} value={expectation} onChange={event => setExpectation(event.target.value)} error={expectation.length > 0 && expectation.trim().length < 10} helperText={`${expectation.trim().length}/10`} sx={{ mb: 2 }} />
        <FormControl><FormLabel>{copy.secondChance}</FormLabel><RadioGroup row value={secondChance} onChange={event => setSecondChance(event.target.value as 'yes' | 'no')}><FormControlLabel value="yes" control={<Radio />} label={copy.yes} /><FormControlLabel value="no" control={<Radio />} label={copy.no} /></RadioGroup></FormControl>
        <Box sx={{ mt: 2 }}><Button variant="contained" disabled={!valid} onClick={() => setReviewing(true)} sx={{ minHeight: 44 }}>{copy.review}</Button></Box>
      </> : <>
        <Typography variant="subtitle1" fontWeight={700}>{copy.reviewTitle}</Typography>
        {[[copy.reasonCode, copy.reasons[reasonCode]], [copy.reason, reason], [copy.disappointing, disappointing], [copy.expectation, expectation], [copy.secondChance, secondChance === 'yes' ? copy.yes : copy.no]].map(([label, value]) => <Paper key={label} variant="outlined" sx={{ p: 1.5, mt: 1.25 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography></Paper>)}
        <Alert severity="warning" sx={{ mt: 2 }}>{copy.formIntro}</Alert>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}><Button onClick={() => setReviewing(false)} sx={{ minHeight: 44 }}>{copy.edit}</Button><Button variant="contained" disabled={saving} onClick={() => void submit()} sx={{ minHeight: 44 }}>{saving ? <CircularProgress size={18} /> : copy.submit}</Button></Box>
      </>}
    </Paper>}

    {requests.length > 0 && <Paper variant="outlined" sx={{ p: 2, mt: 3, borderRadius: 3 }}><Typography fontWeight={700}>{copy.requests}</Typography>{requests.slice(0, 5).map(request => <Typography key={`${request.type || 'request'}-${request.id}`} variant="body2" color="text.secondary" sx={{ mt: 1 }}>{new Intl.DateTimeFormat(locale).format(new Date(request.created_at))} · {request.type === 'payment_problem' ? (lang === 'pt' ? 'pagamento' : 'payment') : (lang === 'pt' ? 'cancelamento' : 'cancellation')} · {copy.statuses[request.status as keyof typeof copy.statuses] || request.status}</Typography>)}</Paper>}
  </Box>;
}

export default function SupportPage() {
  return <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}><SupportPageContent /></Suspense>;
}
