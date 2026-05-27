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
import Link from 'next/link';
import { type UiLang, resolveUiLang } from '@/lib/i18n';
import { getTutorials, getTutorialsIntro, type TutorialIconId } from '@/lib/tutorials/content';

const ICONS: Record<TutorialIconId, React.ElementType> = {
  balys: SmartToyIcon,
  notes: NoteIcon,
  briefing: WbSunnyIcon,
  connections: ElectricalServicesIcon,
  goals: TrackChangesIcon,
  calendar: CalendarMonthIcon,
  today: TodayIcon,
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1000, mx: 'auto', width: '100%', overflowY: 'auto' }}>
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
              sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', height: '100%' }}
            >
              <CardActionArea
                component={Link}
                href={`/app/tutorials/${t.slug}`}
                sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}
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
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.25) 100%)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ color: 'primary.light', fontSize: 22 }} />
                  </Box>
                  <Chip size="small" label={`${t.readMinutes} ${minutesLabel}`} variant="outlined" sx={{ color: 'text.disabled' }} />
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
