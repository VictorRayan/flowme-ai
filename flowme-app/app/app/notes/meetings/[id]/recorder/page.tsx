'use client';

import * as React from 'react';
import { Box, Typography, Button, Stack, CircularProgress, Chip, Paper } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { useParams } from 'next/navigation';
import { useRecording } from '@/components/meetings/RecordingProvider';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function RecorderPage() {
  const params = useParams<{ id: string }>();
  const recording = useRecording();
  const activeMeetingId = recording.meetingId;
  const pageMeetingId = params?.id;
  const isThisMeeting = activeMeetingId === pageMeetingId;
  const isStopping = recording.status === 'stopping' || recording.status === 'finalizing';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#050505', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050505 50%)', p: { xs: 3, md: 6 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 560, bgcolor: 'rgba(17,18,45,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, p: { xs: 3, md: 5 }, color: '#fff' }}>
        <Stack spacing={3} alignItems="center" textAlign="center">
          <FiberManualRecordIcon sx={{ color: '#ef4444', fontSize: 56, animation: 'recPulse 1.2s ease-in-out infinite' }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{recording.meetingTitle || 'Reunião'}</Typography>
          <Typography variant="h2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
            {formatMs(recording.elapsedMs)}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            {recording.capturedSources.map((s) => (
              <Chip key={s} size="small" label={s === 'microphone' ? 'Microfone' : 'Áudio do sistema'} sx={{ bgcolor: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }} />
            ))}
          </Stack>

          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Enviando chunks a cada 2 minutos · {recording.uploadSnapshot.uploaded} enviados
            {recording.uploadSnapshot.pending + recording.uploadSnapshot.inflight > 0 && `, ${recording.uploadSnapshot.pending + recording.uploadSnapshot.inflight} em andamento`}
            {recording.uploadSnapshot.failed > 0 && ` · ${recording.uploadSnapshot.failed} falhas (vão re-tentar)`}
          </Typography>

          {!isThisMeeting && (
            <Typography variant="body2" sx={{ color: '#fbbf24' }}>
              Nenhuma gravação ativa para este id. Volte e inicie uma nova.
            </Typography>
          )}

          <Button
            size="large"
            variant="contained"
            color="error"
            disabled={!isThisMeeting || isStopping}
            startIcon={isStopping ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <StopCircleIcon />}
            onClick={() => recording.stop()}
            data-testid="recorder-stop-button"
            sx={{ borderRadius: 999, px: 4, py: 1.5, fontSize: 16, textTransform: 'none', fontWeight: 700 }}
          >
            {isStopping ? 'Finalizando…' : 'Parar gravação'}
          </Button>

          {recording.error && (
            <Typography sx={{ color: '#f87171', fontSize: 13 }}>{recording.error}</Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
