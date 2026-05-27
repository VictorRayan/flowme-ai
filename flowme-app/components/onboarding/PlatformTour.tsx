'use client';

import * as React from 'react';
import { Box, Typography, Button, Stack, CircularProgress, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HubIcon from '@mui/icons-material/Hub';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SchoolIcon from '@mui/icons-material/School';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import {
  getTourSections,
  getTourLabels,
  reviewSectionIndex,
  clampSectionIndex,
  type TourLang,
  type SectionId,
} from '@/lib/onboarding/tour-content';

const SECTION_ICON: Record<SectionId, React.ElementType> = {
  balys: AutoAwesomeIcon,
  connections: HubIcon,
  notes: EditNoteIcon,
  review: SchoolIcon,
};

const cardSx = {
  p: 2.5,
  borderRadius: 3,
  bgcolor: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
};

export default function PlatformTour({
  lang,
  onComplete,
  completing,
  error,
}: {
  lang: TourLang;
  onComplete: () => void;
  completing: boolean;
  error?: string | null;
}) {
  const sections = getTourSections(lang);
  const labels = getTourLabels(lang);
  const reviewIdx = reviewSectionIndex(sections);
  const [index, setIndex] = React.useState(0);

  const section = sections[index];
  const total = sections.length;
  const Icon = SECTION_ICON[section.id];
  const isReview = section.mandatory;

  const goNext = () => setIndex((i) => clampSectionIndex(i + 1, total));
  const goBack = () => setIndex((i) => clampSectionIndex(i - 1, total));
  const skipToReview = () => setIndex(reviewIdx);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Section progress dots */}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 4 }}>
        {sections.map((s, i) => (
          <Box
            key={s.id}
            sx={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor: i === index ? 'primary.main' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </Stack>

      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Icon sx={{ fontSize: 64, color: isReview ? 'primary.main' : 'primary.light', mb: 2 }} />
        <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 700 }}>
          {section.overline}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, mb: 2, color: '#fff', letterSpacing: '-1px' }}>
          {section.title}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: 15, md: 17 }, lineHeight: 1.7 }}>
          {section.intro}
        </Typography>
      </Box>

      {section.features.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          {section.features.map((f) => (
            <Box key={f.title} sx={cardSx}>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>{f.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                {f.example}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {section.bullets.length > 0 && (
        <Box sx={{ ...cardSx, mb: 2.5 }}>
          <Stack spacing={1.25}>
            {section.bullets.map((b, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.light', mt: '8px', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {b}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {section.tip && (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            p: 2.5,
            mb: 2.5,
            borderRadius: 3,
            bgcolor: 'rgba(99,102,241,0.10)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          <LightbulbOutlinedIcon sx={{ color: '#a5b4fc', fontSize: 22, flexShrink: 0, mt: '2px' }} />
          <Typography variant="body2" sx={{ color: '#c7d2fe', lineHeight: 1.6 }}>
            {section.tip}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(127,29,29,0.35)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.25)' }}>
          {error}
        </Alert>
      )}

      {/* Navigation */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1 }}>
        <Button
          onClick={goBack}
          disabled={index === 0 || completing}
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', visibility: index === 0 ? 'hidden' : 'visible' }}
        >
          {labels.back}
        </Button>

        <Box sx={{ flex: 1 }} />

        {!isReview && (
          <Button onClick={skipToReview} disabled={completing} sx={{ color: 'text.disabled', textTransform: 'none' }}>
            {labels.skip}
          </Button>
        )}

        {isReview ? (
          <Button
            variant="contained"
            size="large"
            onClick={onComplete}
            disabled={completing}
            startIcon={completing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : null}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 3,
              fontSize: 17,
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              '&.Mui-disabled': { background: 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)', color: 'rgba(255,255,255,0.85)' },
            }}
          >
            {labels.finish}
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            onClick={goNext}
            endIcon={<ArrowForwardIcon />}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 3,
              fontSize: 17,
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            {labels.next}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
