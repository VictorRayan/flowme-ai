'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSearchParams } from 'next/navigation';

const QUICK_QUESTIONS = [
  'Como eu começo no Flow Me?',
  'Como usar o BalysAI melhor?',
  'Como funcionam os créditos de IA?',
  'Qual a diferença entre Free e Pro?',
  'Como conectar meu WhatsApp?',
  'Como usar o Balys pelo WhatsApp?',
  'Como criar lembretes?',
  'Como entrar em flow hoje?',
  'Como o Today organiza meu dia?',
  'Como criar uma meta e um plano?',
  'Como funciona o conselho?',
  'Como funciona a revisão semanal?',
  'Como funciona a revisão mensal?',
  'Como registrar despesas?',
  'Como ver minha saúde financeira?',
  'Como conectar Google Docs/Sheets/Drive/Gmail?',
  'Como gravar e revisar reuniões?',
  'Estou com problema de pagamento',
  'Quero cancelar minha assinatura',
];

function SupportPageContent() {
  const searchParams = useSearchParams();
  const startsWithCancellation = searchParams.get('intent') === 'cancel_subscription';
  const [reason, setReason] = useState('');
  const [disappointingFeatures, setDisappointingFeatures] = useState('');
  const [unmetExpectation, setUnmetExpectation] = useState('');
  const [wouldAcceptHumanSupport, setWouldAcceptHumanSupport] = useState<'yes' | 'no'>('yes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [requests, setRequests] = useState<Array<{ id: string; status: string; created_at: string }>>([]);
  const [billing, setBilling] = useState<{ plan_code: string; billing_state: string; provider: string | null } | null>(null);
  const [cancellationIntent, setCancellationIntent] = useState(startsWithCancellation);

  const selectedPrompt = useMemo(() => {
    if (startsWithCancellation) return 'Quero cancelar minha assinatura';
    return QUICK_QUESTIONS[0];
  }, [startsWithCancellation]);

  useEffect(() => {
    const draft = localStorage.getItem('support_cancellation_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setReason(parsed.reason || '');
        setDisappointingFeatures(parsed.disappointingFeatures || '');
        setUnmetExpectation(parsed.unmetExpectation || '');
        setWouldAcceptHumanSupport(parsed.wouldAcceptHumanSupport === 'no' ? 'no' : 'yes');
      } catch {}
    }
    Promise.all([
      fetch('/api/support/requests').then(res => res.json()),
      fetch('/api/billing/entitlements').then(res => res.json()),
    ]).then(([requestData, billingData]) => {
      if (requestData?.ok) setRequests(requestData.requests || []);
      if (billingData?.ok) setBilling({
        ...(billingData.entitlements || {}),
        provider: billingData.billing?.provider || null,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('support_cancellation_draft', JSON.stringify({ reason, disappointingFeatures, unmetExpectation, wouldAcceptHumanSupport }));
  }, [reason, disappointingFeatures, unmetExpectation, wouldAcceptHumanSupport]);

  const sendSupportMessage = async (prompt?: string) => {
    const message = (prompt || chatInput).trim();
    if (!message || chatLoading) return;
    setMessages(current => [...current, { role: 'user', content: message }]);
    setChatInput('');
    setChatLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Não consegui consultar o suporte.');
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
      if (data.intent === 'cancel_subscription') setCancellationIntent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não consegui consultar o suporte.');
    } finally {
      setChatLoading(false);
    }
  };

  const submitCancellation = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/support/cancellation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          disappointing_features: disappointingFeatures,
          unmet_expectation: unmetExpectation,
          would_accept_human_support: wouldAcceptHumanSupport === 'yes',
          source: searchParams.get('source') === 'billing_page' ? 'billing_page' : 'support_balys',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Não consegui registrar a solicitação.');
      setSuccess('Solicitação registrada. O suporte vai revisar seu caso antes de qualquer alteração na assinatura.');
      setReason('');
      setDisappointingFeatures('');
      setUnmetExpectation('');
      setWouldAcceptHumanSupport('yes');
      localStorage.removeItem('support_cancellation_draft');
      const requestRes = await fetch('/api/support/requests');
      const requestData = await requestRes.json();
      if (requestData?.ok) setRequests(requestData.requests || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não consegui registrar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 960, mx: 'auto', width: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <SupportAgentIcon color="primary" />
        <Typography variant="h4" fontWeight={800}>Suporte</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Balys ajuda com produto, pagamento, melhores formas de uso e solicitações que precisam de revisão humana.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr' }, gap: 3 }}>
        <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h6" fontWeight={700}>Balys Suporte</Typography>
            <Chip size="small" label={`${billing?.plan_code?.toUpperCase() || 'FREE'} · ${billing?.billing_state || 'free'}`} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Escolha uma pergunta rápida para começar ou use o formulário ao lado quando o assunto for cancelamento.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {QUICK_QUESTIONS.map(question => (
              <Chip
                key={question}
                label={question}
                color={question === selectedPrompt ? 'primary' : 'default'}
                variant={question === selectedPrompt ? 'filled' : 'outlined'}
                clickable
                onClick={() => void sendSupportMessage(question)}
              />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          {messages.length > 0 && (
            <Box sx={{ display: 'grid', gap: 1.25, mb: 2, maxHeight: 320, overflowY: 'auto' }}>
              {messages.map((message, index) => (
                <Box key={`${message.role}-${index}`} sx={{ p: 1.25, bgcolor: message.role === 'user' ? 'action.selected' : 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField fullWidth size="small" label="Como podemos ajudar?" value={chatInput} onChange={event => setChatInput(event.target.value)} multiline maxRows={4} />
            <Button variant="contained" onClick={() => void sendSupportMessage()} disabled={chatLoading || !chatInput.trim()} sx={{ minWidth: 44, minHeight: 44 }} aria-label="Enviar pergunta">
              {chatLoading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            </Button>
          </Box>
          {cancellationIntent && <Alert severity="warning" sx={{ mt: 2 }}>Antes de cancelar, vamos entender o motivo e verificar se suporte humano pode ajudar.</Alert>}
          {cancellationIntent && (billing?.provider === 'apple' || billing?.provider === 'google') && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Para efeito imediato, conclua o cancelamento também pela {billing.provider === 'apple' ? 'App Store' : 'Google Play'}. Sua solicitação interna continuará registrada.
            </Alert>
          )}
          {requests.some(request => request.status === 'open' || request.status === 'in_review') && (
            <Alert severity="info" sx={{ mt: 2 }}>Sua solicitação está em análise. Você pode continuar conversando com o suporte enquanto aguarda.</Alert>
          )}
        </Paper>

        <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700}>Solicitação de cancelamento</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            A solicitação fica aberta para revisão. Isso evita cancelamentos impulsivos e ajuda o suporte a resolver o problema certo.
          </Typography>

          <TextField
            label="Qual o principal motivo do cancelamento?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            helperText={`${reason.trim().length}/100 caracteres mínimos`}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Quais funcionalidades mais te decepcionaram?"
            value={disappointingFeatures}
            onChange={e => setDisappointingFeatures(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText={`${disappointingFeatures.trim().length}/10 caracteres mínimos`}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Qual expectativa não foi atendida?"
            value={unmetExpectation}
            onChange={e => setUnmetExpectation(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText={`${unmetExpectation.trim().length}/10 caracteres mínimos`}
            sx={{ mb: 2 }}
          />

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Se um suporte humano te instruir melhor, você daria uma segunda chance?</FormLabel>
            <RadioGroup
              row
              value={wouldAcceptHumanSupport}
              onChange={e => setWouldAcceptHumanSupport(e.target.value as 'yes' | 'no')}
            >
              <FormControlLabel value="yes" control={<Radio />} label="Sim" />
              <FormControlLabel value="no" control={<Radio />} label="Não" />
            </RadioGroup>
          </FormControl>

          <Box>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={submitCancellation}
              disabled={saving}
            >
              Enviar solicitação
            </Button>
          </Box>
          {requests.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="subtitle2" fontWeight={700}>Solicitações recentes</Typography>
              {requests.slice(0, 3).map(request => (
                <Typography key={request.id} variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {new Date(request.created_at).toLocaleDateString('pt-BR')} · {request.status}
                </Typography>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    }>
      <SupportPageContent />
    </Suspense>
  );
}
