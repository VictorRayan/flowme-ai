'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, LinearProgress, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const TYPES = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'investment', label: 'Investimento' },
  { value: 'transfer', label: 'Transferência' },
];

const CATEGORIES = ['alimentação', 'mercado', 'transporte', 'moradia', 'saúde', 'educação', 'lazer', 'assinaturas', 'impostos', 'dívidas', 'salário', 'renda fixa', 'outros'];
const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN'];

function monthNow() {
  return new Date().toISOString().slice(0, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
}

export default function FinancePage() {
  const [month, setMonth] = useState(monthNow());
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'BRL',
    occurred_on: today(),
    category_name: 'alimentação',
    merchant: '',
    description: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/finance/summary?month=${month}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) setError(body?.error?.message || 'Não foi possível carregar suas finanças.');
    else {
      setSummary(body.summary);
      setForm(prev => ({ ...prev, currency: body.summary.currency || prev.currency }));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [month]);

  const submit = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/api/finance/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(String(form.amount).replace(',', '.')), source: 'web' }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !body?.ok) {
      setError(body?.error?.message || 'Não foi possível salvar a transação.');
      return;
    }
    setOpen(false);
    setForm(prev => ({ ...prev, amount: '', merchant: '', description: '', occurred_on: today() }));
    void load();
  };

  const categories = summary?.category_breakdown || [];
  const recurringExpenses = summary?.recurring_expenses || [];
  const recurringImpact = recurringExpenses.reduce((total: number, item: any) => total + Number(item.monthly_impact || 0), 0);
  const hasTransactions = (summary?.recent_transactions || []).length > 0;
  const previousDelta = summary?.previous_month?.delta_expenses;
  const deltaLabel = useMemo(() => {
    if (previousDelta === undefined) return null;
    if (previousDelta === 0) return 'igual ao mês anterior';
    return `${previousDelta > 0 ? '+' : ''}${money(previousDelta, summary.currency)} vs mês anterior`;
  }, [previousDelta, summary]);

  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1180, mx: 'auto', width: '100%' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Finanças</Typography>
          <Typography color="text.secondary">Dashboard mensal dos seus custos, receitas e investimentos.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 150 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ minHeight: 44 }}>
            Adicionar
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <Metric title="Gastos" value={money(summary.total_expenses, summary.currency)} detail={deltaLabel} />
        <Metric title="Receitas" value={money(summary.total_income, summary.currency)} />
        <Metric title="Investido" value={money(summary.total_invested, summary.currency)} />
        <Metric title="Saldo" value={money(summary.net_balance, summary.currency)} tone={summary.net_balance >= 0 ? 'success.main' : 'error.main'} />
        <Metric title="Taxa de investimento" value={summary.investment_rate === null ? '-' : `${Math.round(summary.investment_rate * 100)}%`} />
      </Stack>

      {summary.goal_alignment?.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 2 }}>Aderência às metas financeiras</Typography>
            <Stack spacing={1.5}>
              {summary.goal_alignment.map((item: any) => (
                <Box key={item.goal_title}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                    <Box>
                      <Typography fontWeight={700}>{item.goal_title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Meta mensal {money(item.monthly_target, item.currency)} · realizado {money(item.actual_saved, item.currency)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={item.status === 'behind' ? 'warning' : 'success'}
                      label={item.status === 'behind' ? `${money(Math.abs(item.gap), item.currency)} abaixo` : 'No ritmo'}
                    />
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, item.adherence * 100))}
                    color={item.status === 'behind' ? 'warning' : 'success'}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {recurringExpenses.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800}>Custos recorrentes detectados</Typography>
                <Typography variant="body2" color="text.secondary">
                  Impacto mensal estimado de {money(recurringImpact, summary.currency)}
                </Typography>
              </Box>
              <Chip size="small" label={`${recurringExpenses.length} padrões`} />
            </Stack>
            <Stack spacing={1.25}>
              {recurringExpenses.slice(0, 5).map((item: any) => (
                <Stack
                  key={`${item.label}-${item.category}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ wordBreak: 'break-word' }}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.category} · {item.occurrences} ocorrências · {item.months_seen.join(', ')}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                    <Typography fontWeight={800}>{money(item.monthly_impact, item.currency)}</Typography>
                    <Chip
                      size="small"
                      color={item.status === 'active' ? 'success' : 'default'}
                      label={item.status === 'active' ? 'ativo' : 'possível'}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {!hasTransactions ? (
        <Card variant="outlined">
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={800}>Nenhuma transação registrada neste mês.</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              Registre pela plataforma ou diga ao Balys: "gastei 42 no almoço".
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Adicionar despesa</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Typography fontWeight={800} sx={{ mb: 2 }}>Gastos por categoria</Typography>
              <Stack spacing={1.5}>
                {categories.length === 0 && <Typography color="text.secondary">Sem despesas confirmadas.</Typography>}
                {categories.map((item: any) => (
                  <Box key={item.category}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography>{item.category}</Typography>
                      <Typography fontWeight={700}>{money(item.amount, summary.currency)}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.min(100, item.share * 100)} sx={{ height: 8, borderRadius: 1 }} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1.35, overflow: 'hidden' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography fontWeight={800}>Transações recentes</Typography>
                {summary.needs_review_count > 0 && <Chip color="warning" label={`${summary.needs_review_count} para revisar`} size="small" />}
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Descrição</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.recent_transactions.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.occurred_on}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.merchant || item.description || item.type}</Typography>
                        {item.status === 'needs_review' && <Chip label="revisar" color="warning" size="small" sx={{ mt: 0.5 }} />}
                      </TableCell>
                      <TableCell>{item.category_name}</TableCell>
                      <TableCell align="right">{money(Number(item.amount), item.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Adicionar transação</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map(type => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputProps={{ inputMode: 'decimal' }} fullWidth />
              <TextField select label="Moeda" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} sx={{ minWidth: 140 }}>
                {CURRENCIES.map(currency => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField type="date" label="Data" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField select label="Categoria" value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })}>
              {CATEGORIES.map(category => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </TextField>
            <TextField label="Estabelecimento" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
            <TextField label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={saving || !form.amount || Number(String(form.amount).replace(',', '.')) <= 0} onClick={submit}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Metric({ title, value, detail, tone }: { title: string; value: string; detail?: string | null; tone?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography variant="h5" fontWeight={900} sx={{ color: tone || 'text.primary', mt: 0.5, wordBreak: 'break-word' }}>
          {value}
        </Typography>
        {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
      </CardContent>
    </Card>
  );
}
