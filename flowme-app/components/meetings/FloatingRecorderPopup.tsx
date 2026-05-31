'use client';

import * as React from 'react';
import { Box, IconButton, Typography, Tooltip, CircularProgress } from '@mui/material';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useRouter } from 'next/navigation';
import { useRecording } from './RecordingProvider';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Persistent floating recording widget mounted at the app root. Google-Meet-style.
export default function FloatingRecorderPopup() {
  const recording = useRecording();
  const router = useRouter();

  if (recording.status === 'idle') return null;
  const isFinalizing = recording.status === 'stopping' || recording.status === 'finalizing';

  return (
    <Box
      role="status"
      aria-label="Gravando reunião"
      sx={{
        position: 'fixed',
        bottom: { xs: 12, md: 24 },
        right: { xs: 12, md: 24 },
        zIndex: (theme) => theme.zIndex.snackbar + 10,
        px: 1.5,
        py: 1,
        minWidth: 240,
        bgcolor: 'rgba(17,18,45,0.96)',
        border: '1px solid rgba(220,38,38,0.4)',
        borderRadius: 999,
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <FiberManualRecordIcon
        sx={{
          color: '#ef4444',
          animation: 'recPulse 1.2s ease-in-out infinite',
          '@keyframes recPulse': {
            '0%, 100%': { opacity: 0.85 },
            '50%': { opacity: 0.35 },
          },
        }}
        fontSize="small"
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }} noWrap>
          {recording.meetingTitle || 'Reunião'}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, mt: 0.25 }}>
          {formatMs(recording.elapsedMs)}
          {recording.uploadSnapshot.pending + recording.uploadSnapshot.inflight > 0 && (
            <> · enviando chunks ({recording.uploadSnapshot.uploaded}↑)</>
          )}
        </Typography>
      </Box>
      <Tooltip title="Abrir gravação">
        <span>
          <IconButton
            size="small"
            disabled={isFinalizing || !recording.meetingId}
            onClick={() => recording.meetingId && router.push(`/app/notes/meetings/${recording.meetingId}/recorder`)}
            sx={{ color: 'rgba(255,255,255,0.8)' }}
          >
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Parar">
        <span>
          <IconButton
            size="small"
            onClick={() => recording.stop()}
            disabled={isFinalizing}
            data-testid="floating-stop-button"
            sx={{ color: '#ef4444' }}
          >
            {isFinalizing ? <CircularProgress size={18} sx={{ color: '#ef4444' }} /> : <StopCircleIcon />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
