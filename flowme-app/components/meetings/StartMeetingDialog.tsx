'use client';

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, FormControlLabel, Checkbox, Stack, Alert,
  useMediaQuery, IconButton, Chip, Autocomplete,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import MicNoneIcon from '@mui/icons-material/MicNone';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useRouter } from 'next/navigation';
import { useRecording } from './RecordingProvider';

interface StartMeetingDialogProps {
  open: boolean;
  onClose: () => void;
}

function mergeParticipants(
  prev: Array<{ id?: string; full_name: string; email?: string }>,
  add: Array<{ id?: string; full_name: string; email?: string }>,
): Array<{ id?: string; full_name: string; email?: string }> {
  const out = [...prev];
  for (const p of add) {
    const dupByEmail = p.email && out.some((x) => x.email && x.email.toLowerCase() === p.email!.toLowerCase());
    const dupByName = !p.email && out.some((x) => x.full_name.trim().toLowerCase() === p.full_name.trim().toLowerCase());
    if (!dupByEmail && !dupByName && p.full_name.trim().length > 0) out.push(p);
  }
  return out;
}

function formatStart(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function StartMeetingDialog({ open, onClose }: StartMeetingDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();
  const recording = useRecording();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [objective, setObjective] = React.useState('');
  const [captureSystemAudio, setCaptureSystemAudio] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [people, setPeople] = React.useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [participants, setParticipants] = React.useState<Array<{ id?: string; full_name: string; email?: string }>>([]);
  const [calendarSuggestions, setCalendarSuggestions] = React.useState<Array<{ id: string; title: string; start_at: string; participants: { displayName?: string; email?: string }[] }>>([]);
  const [appliedSuggestionId, setAppliedSuggestionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle(''); setSubject(''); setObjective('');
      setCaptureSystemAudio(false); setConsent(false); setSubmitting(false);
      setParticipants([]); setAppliedSuggestionId(null); setUploadError(null);
      // Load people + nearby calendar events (best-effort; failure stays silent).
      fetch('/api/people').then((r) => r.ok ? r.json() : null).then((b) => {
        if (Array.isArray(b?.people)) setPeople(b.people.map((p: any) => ({ id: p.id, full_name: p.full_name || p.name || '', email: p.email })));
      }).catch(() => {});
      const start = new Date(Date.now() - 30 * 60_000).toISOString();
      const end = new Date(Date.now() + 90 * 60_000).toISOString();
      fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&includeGoogleEvents=true&includeFlowmeEvents=false`).then((r) => r.ok ? r.json() : null).then((b) => {
        if (Array.isArray(b?.events)) setCalendarSuggestions(b.events.slice(0, 3));
      }).catch(() => {});
    }
  }, [open]);

  function applySuggestion(ev: { id: string; title: string; participants: { displayName?: string; email?: string }[] }) {
    setTitle(ev.title || title);
    const seedFromEvent = (ev.participants || []).map((p) => ({ full_name: p.displayName || p.email || '', email: p.email }));
    const merged: Array<{ id?: string; full_name: string; email?: string }> = [];
    for (const seed of seedFromEvent) {
      if (!seed.full_name) continue;
      const existing = people.find((p) => p.email && seed.email && p.email.toLowerCase() === seed.email.toLowerCase());
      merged.push(existing || seed);
    }
    setParticipants((prev) => mergeParticipants(prev, merged));
    setAppliedSuggestionId(ev.id);
  }

  const canStart = title.trim().length >= 2 && consent && !submitting && recording.status === 'idle';
  const canUpload = title.trim().length >= 2 && consent && !submitting && recording.status === 'idle';

  async function handleUploadFile(file: File) {
    if (!canUpload) return;
    setSubmitting(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mime_type', file.type || 'audio/webm');
      form.append('title', title.trim());
      if (subject.trim()) form.append('subject', subject.trim());
      if (objective.trim()) form.append('objective', objective.trim());
      const hint = participants.map((p) => p.full_name).filter(Boolean);
      if (hint.length > 0) form.append('participants_hint', JSON.stringify(hint));
      form.append('consent', '1');
      const res = await fetch('/api/meetings/upload', { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.meeting?.id) throw new Error(body?.error?.message || 'upload_failed');
      onClose();
      router.push(`/app/notes/meetings/${body.meeting.id}/finalize`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'upload_failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart() {
    if (!canStart) return;
    setSubmitting(true);
    await recording.start({
      title: title.trim(),
      subject: subject.trim() || undefined,
      objective: objective.trim() || undefined,
      captureSystemAudio,
      participantsHint: participants.map((p) => p.full_name).filter(Boolean),
    });
    setSubmitting(false);
    if (!recording.error) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="start-meeting-title">
      <DialogTitle id="start-meeting-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Gravar reunião
        <IconButton onClick={onClose} aria-label="Fechar"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {calendarSuggestions.length > 0 && (
            <Stack spacing={0.75}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                É esta reunião?
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {calendarSuggestions.map((ev) => (
                  <Chip
                    key={ev.id}
                    label={`${formatStart(ev.start_at)} · ${ev.title}`}
                    color={appliedSuggestionId === ev.id ? 'primary' : 'default'}
                    onClick={() => applySuggestion(ev)}
                    data-testid={`calendar-suggestion-${ev.id}`}
                    sx={{ maxWidth: '100%' }}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          <TextField
            label="Nome da reunião"
            placeholder="Ex.: 1:1 com Joao"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            label="Assunto (opcional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label="Objetivo (opcional)"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            multiline
            minRows={2}
          />

          <Autocomplete
            multiple
            freeSolo
            options={people}
            getOptionLabel={(p) => typeof p === 'string' ? p : (p.full_name || '')}
            value={participants}
            onChange={(_, newValue) => {
              const normalized = newValue.map((v) => typeof v === 'string' ? { full_name: v.trim() } : v).filter((p) => p.full_name);
              setParticipants(normalized);
            }}
            isOptionEqualToValue={(opt, val) => (opt.id ? opt.id === val.id : opt.full_name === val.full_name)}
            renderInput={(params) => (
              <TextField {...params} label="Participantes (opcional)" placeholder="Adicione pessoas" inputProps={{ ...params.inputProps, 'data-testid': 'participants-input' }} />
            )}
          />

          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              Fontes de áudio
            </Typography>
            <FormControlLabel
              control={<Checkbox checked disabled />}
              label={<span><MicNoneIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />Microfone (sempre)</span>}
            />
            <FormControlLabel
              control={<Checkbox checked={captureSystemAudio} onChange={(e) => setCaptureSystemAudio(e.target.checked)} />}
              label={<span><LaptopMacIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />Áudio do sistema (compartilhamento de tela com áudio)</span>}
            />
            {captureSystemAudio && (
              <Typography variant="caption" color="text.secondary">
                Seu navegador vai pedir pra escolher uma janela ou aba e marcar &ldquo;Compartilhar áudio&rdquo;. Não compartilhamos vídeo.
              </Typography>
            )}
          </Stack>

          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            label="Confirmo que todos os participantes foram avisados que a reunião será gravada e transcrita."
          />

          {(recording.error || uploadError) && (
            <Alert severity="error">{uploadError || recording.error}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={!canUpload}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-existing-audio"
          >
            Subir áudio
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await handleUploadFile(f);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <Button onClick={handleStart} variant="contained" color="error" disabled={!canStart} data-testid="start-meeting-confirm">
            Iniciar gravação
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
