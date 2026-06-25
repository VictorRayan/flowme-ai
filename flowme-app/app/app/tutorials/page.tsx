'use client';

import * as React from 'react';
import { Box, Typography, Card, CardActionArea, Chip, Stack } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import NoteIcon from '@mui/icons-material/Note';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Link from 'next/link';
import { type UiLang, resolveUiLang } from '@/lib/i18n';
import { getTutorials, getTutorialsIntro, type TutorialIconId } from '@/lib/tutorials/content';
import GmailBrandIcon from '@/components/icons/GmailBrandIcon';
import GoogleDocsBrandIcon from '@/components/icons/GoogleDocsBrandIcon';
import GoogleDriveBrandIcon from '@/components/icons/GoogleDriveBrandIcon';
import GoogleSheetsBrandIcon from '@/components/icons/GoogleSheetsBrandIcon';

const ICONS: Record<TutorialIconId, React.ElementType> = {
  balys: SmartToyIcon,
  notes: NoteIcon,
  briefing: WbSunnyIcon,
  connections: ElectricalServicesIcon,
  goals: TrackChangesIcon,
  calendar: CalendarMonthIcon,
  today: TodayIcon,
  gmail: GmailBrandIcon,
  docs: GoogleDocsBrandIcon,
  sheets: GoogleSheetsBrandIcon,
  drive: GoogleDriveBrandIcon,
  support: SupportAgentIcon,
};

const ACCENTS: Record<TutorialIconId, { glow: string; border: string; iconBg: string; iconColor: string; chip: string }> = {
  balys: { glow: 'rgba(139,92,246,0.26)', border: 'rgba(139,92,246,0.45)', iconBg: 'linear-gradient(135deg, #6d5dfc, #14b8ff)', iconColor: '#fff', chip: '#c4b5fd' },
  notes: { glow: 'rgba(250,204,21,0.18)', border: 'rgba(250,204,21,0.34)', iconBg: 'linear-gradient(135deg, #f59e0b, #facc15)', iconColor: '#111827', chip: '#fde68a' },
  briefing: { glow: 'rgba(251,146,60,0.20)', border: 'rgba(251,146,60,0.38)', iconBg: 'linear-gradient(135deg, #fb923c, #f97316)', iconColor: '#fff', chip: '#fed7aa' },
  connections: { glow: 'rgba(34,211,238,0.18)', border: 'rgba(34,211,238,0.36)', iconBg: 'linear-gradient(135deg, #06b6d4, #3b82f6)', iconColor: '#fff', chip: '#a5f3fc' },
  goals: { glow: 'rgba(52,211,153,0.18)', border: 'rgba(52,211,153,0.34)', iconBg: 'linear-gradient(135deg, #10b981, #22c55e)', iconColor: '#04120c', chip: '#a7f3d0' },
  calendar: { glow: 'rgba(96,165,250,0.18)', border: 'rgba(96,165,250,0.36)', iconBg: 'linear-gradient(135deg, #2563eb, #60a5fa)', iconColor: '#fff', chip: '#bfdbfe' },
  today: { glow: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.36)', iconBg: 'linear-gradient(135deg, #0ea5e9, #22d3ee)', iconColor: '#02131f', chip: '#bae6fd' },
  gmail: { glow: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.35)', iconBg: 'rgba(255,255,255,0.92)', iconColor: '#ef4444', chip: '#fecaca' },
  docs: { glow: 'rgba(59,130,246,0.20)', border: 'rgba(59,130,246,0.38)', iconBg: 'rgba(59,130,246,0.20)', iconColor: '#60a5fa', chip: '#bfdbfe' },
  sheets: { glow: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.36)', iconBg: 'rgba(34,197,94,0.18)', iconColor: '#4ade80', chip: '#bbf7d0' },
  drive: { glow: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', iconBg: 'rgba(255,255,255,0.92)', iconColor: '#f59e0b', chip: '#fde68a' },
  support: { glow: 'rgba(45,212,191,0.18)', border: 'rgba(45,212,191,0.36)', iconBg: 'linear-gradient(135deg, #14b8a6, #8b5cf6)', iconColor: '#fff', chip: '#99f6e4' },
};

export default function TutorialsPage() {
  const [uiLang, setUiLang] = React.useState<UiLang>('en');

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const intro = getTutorialsIntro(uiLang);
  const tutorials = getTutorials(uiLang);
  const minutesLabel = uiLang === 'pt' ? 'min de leitura' : 'min read';

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 1080,
        mx: 'auto',
        width: '100%',
        overflowY: 'auto',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 18% 8%, rgba(139,92,246,0.16), transparent 28%), radial-gradient(circle at 88% 16%, rgba(34,211,238,0.10), transparent 24%), radial-gradient(circle at 45% 100%, rgba(249,115,22,0.08), transparent 30%)',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <SchoolIcon sx={{ color: 'primary.light', fontSize: 30 }} />
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.5px' }}>
          {intro.title}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" sx={{ color: 'primary.light', fontWeight: 600, mb: 1 }}>
        {intro.subtitle}
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720, lineHeight: 1.7, mb: 4 }}>
        {intro.body}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
        }}
      >
        {tutorials.map((t) => {
          const Icon = ICONS[t.iconId];
          return (
            <Card
              key={t.slug}
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: 4,
                bgcolor: 'rgba(15,23,42,0.72)',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                borderColor: ACCENTS[t.iconId].border,
                boxShadow: `0 18px 60px ${ACCENTS[t.iconId].glow}`,
                transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(145deg, ${ACCENTS[t.iconId].glow}, transparent 42%)`,
                  opacity: 0.75,
                },
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 24px 80px ${ACCENTS[t.iconId].glow}`,
                },
              }}
            >
              <CardActionArea
                component={Link}
                href={`/app/tutorials/${t.slug}`}
                sx={{
                  p: 2.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: ACCENTS[t.iconId].iconBg,
                      flexShrink: 0,
                      boxShadow: `0 12px 32px ${ACCENTS[t.iconId].glow}`,
                    }}
                  >
                    <Icon sx={{ color: ACCENTS[t.iconId].iconColor, fontSize: 23 }} />
                  </Box>
                  <Chip
                    size="small"
                    label={`${t.readMinutes} ${minutesLabel}`}
                    variant="outlined"
                    sx={{ color: ACCENTS[t.iconId].chip, borderColor: ACCENTS[t.iconId].border, bgcolor: 'rgba(2,6,23,0.32)' }}
                  />
                </Stack>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.3px' }}>
                  {t.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
                  {t.summary}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 2, color: 'primary.light' }}>
                  <Typography variant="body2" fontWeight={600}>
                    {uiLang === 'pt' ? 'Abrir guia' : 'Open guide'}
                  </Typography>
                  <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
