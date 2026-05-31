'use client';

import * as React from 'react';
import {
  Box, Container, Typography, Paper, Stack, Button, TextField, CircularProgress, Alert, Chip, IconButton, Tooltip,
  Autocomplete,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import DownloadIcon from '@mui/icons-material/Download';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useParams, useRouter } from 'next/navigation';
import TaskAcceptPopover from '@/components/meetings/TaskAcceptPopover';

interface MeetingPayload {
  meeting: any;
  speakers: any[];
  segments: any[];
  tasks: any[];
  corrections: any[];
}

interface Person {
  id: string;
  full_name: string;
}

export default function FinalizeMeetingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meetingId = params?.id || '';
  const [data, setData] = React.useState<MeetingPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [speakerAssignments, setSpeakerAssignments] = React.useState<Record<string, { personId: string | null; displayLabel: string }>>({});
  const [saving, setSaving] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [recordingCorrection, setRecordingCorrection] = React.useState(false);
  const [acceptTask, setAcceptTask] = React.useState<{ taskId: string; description: string; anchor: HTMLElement } | null>(null);

  async function dismissTask(taskId: string) {
    await fetch(`/api/meetings/${meetingId}/tasks`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tasks: [{ id: taskId, status: 'dismissed' }] }),
    });
    await fetchMeeting();
  }
  const [correctionMimeType, setCorrectionMimeType] = React.useState('audio/webm');
  const correctionRecorderRef = React.useRef<MediaRecorder | null>(null);
  const correctionChunksRef = React.useRef<Blob[]>([]);
  const [submittingCorrection, setSubmittingCorrection] = React.useState(false);

  const fetchMeeting = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = await res.json();
      setData(body);
      const assignments: Record<string, { personId: string | null; displayLabel: string }> = {};
      for (const sp of body.speakers || []) {
        assignments[sp.id] = { personId: sp.person_id || null, displayLabel: sp.display_label };
      }
      setSpeakerAssignments(assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const fetchPeople = React.useCallback(async () => {
    try {
      const res = await fetch('/api/people');
      if (!res.ok) return;
      const body = await res.json();
      setPeople(((body.people || []) as any[]).map((p) => ({ id: p.id, full_name: p.full_name || p.name || '(sem nome)' })));
    } catch {}
  }, []);

  const fetchAudio = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/audio`);
      if (!res.ok) return;
      const body = await res.json();
      setAudioUrl(body.url);
    } catch {}
  }, [meetingId]);

  React.useEffect(() => {
    if (!meetingId) return;
    fetchMeeting();
    fetchPeople();
    fetchAudio();
  }, [meetingId, fetchMeeting, fetchPeople, fetchAudio]);

  // Poll while still processing or reanalyzing.
  React.useEffect(() => {
    if (!data) return;
    const status = data.meeting.status;
    if (status === 'processing' || status === 'reanalyzing' || status === 'audio_persisted') {
      const t = setInterval(fetchMeeting, 3000);
      return () => clearInterval(t);
    }
  }, [data, fetchMeeting]);

  async function handleCreatePerson(name: string): Promise<Person | null> {
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      });
      const body = await res.json();
      if (!res.ok) return null;
      const person = body.person || body;
      const created: Person = { id: person.id, full_name: person.full_name || name };
      setPeople((p) => [...p, created]);
      return created;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const payload = (data.speakers || []).map((sp: any) => {
        const a = speakerAssignments[sp.id] || { personId: null, displayLabel: sp.display_label };
        return {
          speakerId: sp.id,
          providerLabel: sp.provider_label,
          displayLabel: a.displayLabel,
          personId: a.personId,
        };
      });
      const res = await fetch(`/api/meetings/${meetingId}/finalize-save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ speakerAssignments: payload, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.ok === false) throw new Error(body?.error?.message || 'save_failed');
      router.push(`/app/notes`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save_failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRetry() {
    setSaving(true);
    try {
      await fetch(`/api/meetings/${meetingId}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      await fetchMeeting();
    } finally {
      setSaving(false);
    }
  }

  async function startCorrectionRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      correctionRecorderRef.current = recorder;
      correctionChunksRef.current = [];
      setCorrectionMimeType(recorder.mimeType || 'audio/webm');
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) correctionChunksRef.current.push(e.data); };
      recorder.start();
      setRecordingCorrection(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'mic_denied');
    }
  }

  async function stopCorrectionRecordingAndSubmit() {
    const recorder = correctionRecorderRef.current;
    if (!recorder) return;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try { recorder.stop(); } catch { resolve(); }
    });
    for (const t of recorder.stream.getTracks()) t.stop();
    setRecordingCorrection(false);
    setSubmittingCorrection(true);
    try {
      const blob = new Blob(correctionChunksRef.current, { type: correctionMimeType });
      const form = new FormData();
      form.append('file', blob, 'correction');
      form.append('mime_type', correctionMimeType);
      const res = await fetch(`/api/meetings/${meetingId}/corrections`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || 'correction_failed');
      }
      await fetchMeeting();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'correction_failed');
    } finally {
      setSubmittingCorrection(false);
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error">{error || 'Reunião não encontrada'}</Alert>
      </Container>
    );
  }

  const m = data.meeting;
  const status = m.status as string;
  const isProcessing = status === 'processing' || status === 'audio_persisted';
  const isReanalyzing = status === 'reanalyzing';
  const isReview = status === 'finalization_review';
  const isFailed = status === 'failed' || status === 'awaiting_retry';
  const isReady = status === 'ready';

  // Speaker summaries from summary.speakerSummaries.
  const summaries: Array<{ providerLabel: string; resumoDeFalas: string; excerpts: string[]; turnCount: number; totalSpokenSeconds: number }> = ((m.summary && m.summary.speakerSummaries) || []) as any[];
  const tasks: Array<{ id: string; description: string; status: string; assignee_person_id: string | null; due_at: string | null }> = (data.tasks || []) as any[];

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{m.title}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label={status.replace('_', ' ')} />
            {m.duration_seconds > 0 && <Chip size="small" variant="outlined" label={`${Math.floor(m.duration_seconds / 60)} min`} />}
          </Stack>
        </Box>

        {audioUrl && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Áudio da reunião</Typography>
            <Box component="audio" controls src={audioUrl} sx={{ display: 'block', width: '100%', mt: 1 }} data-testid="meeting-audio-player" />
          </Paper>
        )}

        {isProcessing && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Processando a reunião… isso pode levar alguns minutos. Você pode fechar essa aba.
          </Alert>
        )}

        {isReanalyzing && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Reanalisando com sua correção…
          </Alert>
        )}

        {isFailed && (
          <Alert severity="error" action={
            <Button color="inherit" size="small" startIcon={<ReplayIcon />} onClick={handleRetry} disabled={saving} data-testid="retry-button">
              Tentar de novo
            </Button>
          }>
            <Typography variant="body2">{m.failure_reason || 'Algo deu errado no processamento.'}</Typography>
            {audioUrl && <Typography variant="caption">O áudio está salvo abaixo — tente reprocessar a qualquer momento.</Typography>}
          </Alert>
        )}

        {isReady && (
          <Alert severity="success">Reunião salva nas suas notas.</Alert>
        )}

        {isReview && (
          <>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="overline" color="text.secondary">Cabeçalho gerado pela IA</Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Assunto" value={m.subject || ''} onChange={(e) => setData((d) => d && { ...d, meeting: { ...d.meeting, subject: e.target.value } })} />
                <TextField label="Objetivo" value={m.objective || ''} multiline minRows={2} onChange={(e) => setData((d) => d && { ...d, meeting: { ...d.meeting, objective: e.target.value } })} />
              </Stack>
            </Paper>

            <Box>
              <Typography variant="overline" color="text.secondary">Falantes</Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {(data.speakers || []).map((sp: any) => {
                  const summary = summaries.find((s) => s.providerLabel === sp.provider_label);
                  const assignment = speakerAssignments[sp.id] || { personId: null, displayLabel: sp.display_label };
                  return (
                    <Paper key={sp.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`speaker-card-${sp.provider_label}`}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                        <Box sx={{ minWidth: 100 }}>
                          <Chip label={`Falante ${sp.provider_label}`} color="primary" />
                          {summary && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                              {summary.turnCount} turnos · {Math.round(summary.totalSpokenSeconds)}s
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {summary && (
                            <>
                              <Typography variant="body2" sx={{ mb: 1 }}>{summary.resumoDeFalas || '(sem resumo)'}</Typography>
                              {summary.excerpts && summary.excerpts.length > 0 && (
                                <Stack spacing={0.5} sx={{ mb: 1 }}>
                                  {summary.excerpts.map((q, i) => (
                                    <Typography key={i} variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>“{q}”</Typography>
                                  ))}
                                </Stack>
                              )}
                            </>
                          )}
                          <Autocomplete
                            options={people}
                            getOptionLabel={(p) => typeof p === 'string' ? p : (p.full_name || '')}
                            value={assignment.personId ? people.find((p) => p.id === assignment.personId) || null : null}
                            freeSolo
                            onChange={async (_, value) => {
                              if (!value) {
                                setSpeakerAssignments((prev) => ({ ...prev, [sp.id]: { personId: null, displayLabel: sp.display_label } }));
                                return;
                              }
                              if (typeof value === 'string') {
                                const created = await handleCreatePerson(value.trim());
                                if (created) {
                                  setSpeakerAssignments((prev) => ({ ...prev, [sp.id]: { personId: created.id, displayLabel: created.full_name } }));
                                }
                                return;
                              }
                              setSpeakerAssignments((prev) => ({ ...prev, [sp.id]: { personId: value.id, displayLabel: value.full_name } }));
                            }}
                            renderInput={(params) => <TextField {...params} size="small" placeholder="Atribuir a uma pessoa (ou digitar pra criar)" inputProps={{ ...params.inputProps, 'data-testid': `speaker-assign-${sp.provider_label}` }} />}
                          />
                          <Button
                            size="small"
                            onClick={() => setSpeakerAssignments((prev) => ({ ...prev, [sp.id]: { personId: null, displayLabel: `Falante ${sp.provider_label}` } }))}
                            sx={{ mt: 1 }}
                          >
                            Manter como Falante {sp.provider_label}
                          </Button>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>

            <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'rgba(99,102,241,0.05)' }}>
              <Typography variant="overline" color="text.secondary">Corrigir interpretação</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5 }}>
                A IA confundiu vozes? Grave um áudio explicando (ex.: &ldquo;Falante 1 e 2 são a mesma pessoa, é o João&rdquo;).
              </Typography>
              <Stack direction="row" spacing={1}>
                {!recordingCorrection ? (
                  <Button
                    variant="outlined"
                    startIcon={<MicIcon />}
                    onClick={startCorrectionRecording}
                    disabled={submittingCorrection || (data.corrections || []).length >= 3}
                    data-testid="correction-record-button"
                  >
                    Gravar correção
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={stopCorrectionRecordingAndSubmit}
                    data-testid="correction-submit-button"
                  >
                    Parar e enviar
                  </Button>
                )}
                {submittingCorrection && <CircularProgress size={24} />}
              </Stack>
              {(data.corrections || []).length >= 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Limite de 3 correções por reunião atingido.
                </Typography>
              )}
            </Paper>

            {tasks.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="meeting-tasks-section">
                <Typography variant="overline" color="text.secondary">Tarefas extraídas</Typography>
                <Stack spacing={1.25} sx={{ mt: 1 }}>
                  {tasks.map((t) => (
                    <Stack key={t.id} direction="row" spacing={1} alignItems="center" sx={{ pb: 1, borderBottom: '1px dashed', borderColor: 'divider' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ textDecoration: t.status === 'dismissed' ? 'line-through' : 'none', color: t.status === 'dismissed' ? 'text.disabled' : 'text.primary' }}>
                          {t.description}
                        </Typography>
                        {t.status !== 'suggested' && (
                          <Chip size="small" label={t.status === 'accepted' ? 'aceita' : 'dispensada'} sx={{ mt: 0.5 }} color={t.status === 'accepted' ? 'success' : 'default'} />
                        )}
                      </Box>
                      {t.status === 'suggested' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CheckIcon />}
                            data-testid={`task-accept-${t.id}`}
                            onClick={(e) => setAcceptTask({ taskId: t.id, description: t.description, anchor: e.currentTarget })}
                          >
                            Aceitar
                          </Button>
                          <IconButton size="small" onClick={() => dismissTask(t.id)} data-testid={`task-dismiss-${t.id}`} aria-label="Dispensar">
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}

            <Box sx={{ position: 'sticky', bottom: 12, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', py: 2, mt: 2 }}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <CheckCircleIcon />}
                data-testid="finalize-save-button"
              >
                {saving ? 'Salvando…' : 'Salvar reunião'}
              </Button>
            </Box>
          </>
        )}

        {audioUrl && (
          <Tooltip title="Baixar áudio">
            <IconButton component="a" href={audioUrl} target="_blank" rel="noreferrer" data-testid="download-audio-button">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {acceptTask && (
        <TaskAcceptPopover
          open
          anchorEl={acceptTask.anchor}
          meetingId={meetingId}
          taskId={acceptTask.taskId}
          taskDescription={acceptTask.description}
          onClose={() => setAcceptTask(null)}
          onAccepted={fetchMeeting}
        />
      )}
    </Container>
  );
}
