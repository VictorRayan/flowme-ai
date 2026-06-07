'use client';

import React, { Suspense, useMemo, useState } from 'react';
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
  'Como funcionam os créditos de IA?',
  'Qual a diferença entre Free e Pro?',
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

  const selectedPrompt = useMemo(() => {
    if (startsWithCancellation) return 'Quero cancelar minha assinatura';
    return QUICK_QUESTIONS[0];
  }, [startsWithCancellation]);

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
    } catch (err: any) {
      setError(err.message);
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
          <Typography variant="h6" fontWeight={700}>Balys Suporte</Typography>
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
              />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Alert severity={startsWithCancellation ? 'warning' : 'info'}>
            {startsWithCancellation
              ? 'Antes de cancelar, vamos entender o motivo e ver se suporte humano consegue recuperar valor para você.'
              : 'Em breve este painel terá chat dedicado com a base de conhecimento completa do Flow Me.'}
          </Alert>
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
