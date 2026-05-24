'use client';

import * as React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightlightIcon from '@mui/icons-material/Nightlight';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type BriefingGreeting = 'morning' | 'afternoon' | 'evening';

function greetingFor(uiLang: 'pt' | 'en'): { kind: BriefingGreeting; title: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return uiLang === 'pt'
      ? { kind: 'morning', title: 'Bom dia', subtitle: 'Confira o que te espera hoje' }
      : { kind: 'morning', title: 'Good morning', subtitle: 'Here is what is ahead today' };
  }
  if (hour >= 12 && hour < 18) {
    return uiLang === 'pt'
      ? { kind: 'afternoon', title: 'Boa tarde', subtitle: 'Resumo do seu dia até agora' }
      : { kind: 'afternoon', title: 'Good afternoon', subtitle: 'Your day so far' };
  }
  return uiLang === 'pt'
    ? { kind: 'evening', title: 'Boa noite', subtitle: 'Resumo do seu dia' }
    : { kind: 'evening', title: 'Good evening', subtitle: 'Today in review' };
}

interface BriefingPillProps {
  userName?: string;
  loading?: boolean;
  onClick: () => void;
  uiLang?: 'pt' | 'en';
}

export default function BriefingPill({ userName, loading, onClick, uiLang = 'pt' }: BriefingPillProps) {
  const g = greetingFor(uiLang);
  const Icon = g.kind === 'evening' ? NightlightIcon : WbSunnyIcon;
  const fullTitle = userName ? `${g.title}, ${userName}` : g.title;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={false}
      aria-label={`${fullTitle}. ${uiLang === 'pt' ? 'Toque para abrir o resumo' : 'Tap to open briefing'}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        mx: { xs: 2, md: 4 },
        my: 2,
        minHeight: 64,
        borderRadius: 3,
        bgcolor: 'rgba(99,102,241,0.10)',
        border: '1px solid rgba(99,102,241,0.30)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': { bgcolor: 'rgba(99,102,241,0.18)' },
        '&:focus-visible': { outline: '2px solid #818cf8', outlineOffset: 2 },
      }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99,102,241,0.18)' }}>
        <Icon sx={{ color: '#a5b4fc', fontSize: 22 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{fullTitle}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.25 }}>
          {loading ? (uiLang === 'pt' ? 'Preparando seu resumo...' : 'Preparing your briefing...') : g.subtitle}
        </Typography>
      </Box>
      {loading ? <CircularProgress size={20} sx={{ color: '#a5b4fc' }} /> : <ChevronRightIcon sx={{ color: '#a5b4fc' }} />}
    </Box>
  );
}
