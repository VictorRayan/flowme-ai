'use client';

import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { parseChecklistText } from '@/lib/checklists/parser';
import { resolveUiLang, type UiLang } from '@/lib/i18n';

type ChecklistItem = {
  id: string;
  title: string;
  checked: boolean;
  sort_order: number;
};

type Checklist = {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  created_by: 'user' | 'balys' | 'voice';
  created_at: string;
  completed_at: string | null;
  items: ChecklistItem[];
};

const copy = {
  pt: {
    title: 'Checklists',
    subtitle: 'Crie listas rápidas para mercado, roupas, viagem, casa ou qualquer compra recorrente.',
    newList: 'Nova checklist',
    name: 'Nome da lista',
    items: 'Itens',
    itemsHint: 'Um item por linha',
    create: 'Criar checklist',
    created: 'Criada em',
    completed: 'Concluída',
    complete: 'Concluir lista',
    delete: 'Apagar',
    empty: 'Nenhuma checklist ainda.',
    active: 'ativas',
    all: 'todas',
    voice: 'Criar por áudio',
    recording: 'Gravando...',
    stop: 'Parar gravação',
    transcribed: 'Áudio interpretado. Revise antes de criar.',
    error: 'Não consegui carregar checklists agora.',
  },
  en: {
    title: 'Checklists',
    subtitle: 'Create quick lists for groceries, clothes, trips, home errands, or recurring purchases.',
    newList: 'New checklist',
    name: 'List name',
    items: 'Items',
    itemsHint: 'One item per line',
    create: 'Create checklist',
    created: 'Created',
    completed: 'Completed',
    complete: 'Complete list',
    delete: 'Delete',
    empty: 'No checklists yet.',
    active: 'active',
    all: 'all',
    voice: 'Create by voice',
    recording: 'Recording...',
    stop: 'Stop recording',
    transcribed: 'Audio interpreted. Review before creating.',
    error: 'Could not load checklists right now.',
  },
};

function completion(checklist: Checklist): number {
  if (checklist.items.length === 0) return 0;
  return Math.round((checklist.items.filter((item) => item.checked).length / checklist.items.length) * 100);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function ChecklistsPage() {
  const [lang, setLang] = React.useState<UiLang>('en');
  const t = copy[lang];
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US';
  const [checklists, setChecklists] = React.useState<Checklist[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<'active' | 'all'>('active');
  const [name, setName] = React.useState('');
  const [itemsText, setItemsText] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const selected = checklists.find((checklist) => checklist.id === selectedId) || checklists[0] || null;

  React.useEffect(() => {
    setLang(resolveUiLang(localStorage.getItem('ui_language')));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/checklists?status=${status}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || t.error);
      setChecklists(data.checklists || []);
      setSelectedId((current) => current && (data.checklists || []).some((checklist: Checklist) => checklist.id === current) ? current : data.checklists?.[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [status, t.error]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createChecklist = async (createdBy: 'user' | 'voice' = 'user') => {
    const items = itemsText.split('\n').map((item) => item.trim()).filter(Boolean);
    if (name.trim().length < 2 || items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items, created_by: createdBy }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'create_failed');
      setName('');
      setItemsText('');
      setSuccess(createdBy === 'voice' ? t.transcribed : t.create);
      await load();
      setSelectedId(data.checklist.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t.error);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (checklist: Checklist, item: ChecklistItem) => {
    setChecklists((current) => current.map((list) => list.id === checklist.id
      ? { ...list, items: list.items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate) }
      : list));
    const response = await fetch(`/api/checklists/${checklist.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !item.checked }),
    });
    if (!response.ok) void load();
  };

  const completeChecklist = async (checklist: Checklist) => {
    await fetch(`/api/checklists/${checklist.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    await load();
  };

  const deleteChecklist = async (checklist: Checklist) => {
    await fetch(`/api/checklists/${checklist.id}`, { method: 'DELETE' });
    await load();
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      void transcribeAudio(new Blob(chunksRef.current, { type: 'audio/webm' }));
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('audio', blob, `checklist-${Date.now()}.webm`);
      const response = await fetch('/api/checklists/transcribe', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'transcribe_failed');
      const parsed = data.checklist || parseChecklistText(data.text || '');
      setName(parsed.name || '');
      setItemsText((parsed.items || []).join('\n'));
      setSuccess(t.transcribed);
    } catch (transcribeError) {
      setError(transcribeError instanceof Error ? transcribeError.message : t.error);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 1280, mx: 'auto', minHeight: '100%', overflowX: 'hidden' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <ChecklistRoundedIcon sx={{ color: '#4ade80' }} />
            <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: '2rem', md: '2.6rem' } }}>{t.title}</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>{t.subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant={status === 'active' ? 'contained' : 'outlined'} onClick={() => setStatus('active')}>{t.active}</Button>
          <Button variant={status === 'all' ? 'contained' : 'outlined'} onClick={() => setStatus('all')}>{t.all}</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, minWidth: 0 }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={800}>{t.newList}</Typography>
            <TextField label={t.name} value={name} onChange={(event) => setName(event.target.value)} fullWidth />
            <TextField label={t.items} value={itemsText} onChange={(event) => setItemsText(event.target.value)} fullWidth multiline minRows={6} placeholder={t.itemsHint} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddRoundedIcon />} variant="contained" disabled={saving || name.trim().length < 2 || itemsText.trim().length < 2} onClick={() => void createChecklist()}>
                {t.create}
              </Button>
              <Button startIcon={recording ? <StopRoundedIcon /> : <MicRoundedIcon />} color={recording ? 'error' : 'inherit'} variant="outlined" disabled={transcribing} onClick={() => recording ? stopRecording() : void startRecording()}>
                {recording ? t.stop : t.voice}
              </Button>
            </Stack>
            {(recording || transcribing) && <Alert severity="info">{recording ? t.recording : <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} /> <span>Transcrevendo...</span></Stack>}</Alert>}
          </Stack>
        </Paper>

        <Box sx={{ minWidth: 0 }}>
          {loading ? <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 260 }}><CircularProgress /></Box> : checklists.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 1, textAlign: 'center' }}>
              <Typography color="text.secondary">{t.empty}</Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(280px, 360px) minmax(0, 1fr)' }, gap: 2 }}>
              <Stack spacing={1.2}>
                {checklists.map((checklist) => {
                  const progress = completion(checklist);
                  return (
                    <Paper key={checklist.id} variant="outlined" onClick={() => setSelectedId(checklist.id)} sx={{ p: 1.5, borderRadius: 1, cursor: 'pointer', borderColor: selected?.id === checklist.id ? 'primary.main' : 'divider', bgcolor: selected?.id === checklist.id ? 'rgba(99,102,241,0.08)' : 'background.paper' }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Typography fontWeight={800} noWrap>{checklist.name}</Typography>
                        <Chip size="small" label={`${progress}%`} color={progress === 100 ? 'success' : 'default'} />
                      </Stack>
                      <LinearProgress variant="determinate" value={progress} sx={{ my: 1, height: 6, borderRadius: 999 }} />
                      <Typography variant="caption" color="text.secondary">{t.created}: {formatDate(checklist.created_at, locale)}</Typography>
                    </Paper>
                  );
                })}
              </Stack>

              {selected && (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h5" fontWeight={900} sx={{ overflowWrap: 'anywhere' }}>{selected.name}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        <Chip size="small" label={`${selected.items.filter((item) => item.checked).length}/${selected.items.length}`} />
                        <Chip size="small" label={`${t.created}: ${formatDate(selected.created_at, locale)}`} variant="outlined" />
                        {selected.status === 'completed' && <Chip size="small" color="success" label={t.completed} />}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={t.complete}><span><IconButton disabled={selected.status === 'completed'} onClick={() => void completeChecklist(selected)}><DoneAllRoundedIcon /></IconButton></span></Tooltip>
                      <Tooltip title={t.delete}><IconButton color="error" onClick={() => void deleteChecklist(selected)}><DeleteRoundedIcon /></IconButton></Tooltip>
                    </Stack>
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={0.8}>
                    {selected.items.map((item) => (
                      <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, px: 1, borderRadius: 1, bgcolor: item.checked ? 'rgba(34,197,94,0.08)' : 'rgba(15,23,42,0.34)' }}>
                        <Checkbox checked={item.checked} onChange={() => void toggleItem(selected, item)} />
                        <Typography sx={{ textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'text.secondary' : 'text.primary', overflowWrap: 'anywhere' }}>{item.title}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
