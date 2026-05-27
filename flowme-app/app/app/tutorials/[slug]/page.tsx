'use client';

import * as React from 'react';
import { Box, Typography, Button, Chip, Stack, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type UiLang, resolveUiLang } from '@/lib/i18n';
import { getTutorial, type TutorialBlock } from '@/lib/tutorials/content';

function StepsBlock({ title, items }: { title?: string; items: string[] }) {
  return (
    <Box sx={{ mb: 3 }}>
      {title && (
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((item, i) => (
          <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                flexShrink: 0,
                mt: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(99,102,241,0.18)',
                color: 'primary.light',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {i + 1}
            </Box>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
              {item}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function Block({ block }: { block: TutorialBlock }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 1.5, letterSpacing: '-0.3px' }}>
          {block.text}
        </Typography>
      );
    case 'paragraph':
      return (
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3 }}>
          {block.text}
        </Typography>
      );
    case 'steps':
      return <StepsBlock title={block.title} items={block.items} />;
    case 'usecase':
      return (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            bgcolor: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#34d399', fontSize: 22, flexShrink: 0, mt: '2px' }} />
          <Box>
            <Typography fontWeight={700} sx={{ color: '#a7f3d0', mb: 0.5 }}>
              {block.title}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
              {block.text}
            </Typography>
          </Box>
        </Box>
      );
    case 'tip':
      return (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            bgcolor: 'rgba(99,102,241,0.10)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          <LightbulbOutlinedIcon sx={{ color: '#a5b4fc', fontSize: 22, flexShrink: 0, mt: '2px' }} />
          <Typography variant="body1" sx={{ color: '#c7d2fe', lineHeight: 1.7 }}>
            {block.text}
          </Typography>
        </Box>
      );
  }
}

export default function TutorialArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
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

  const tutorial = getTutorial(uiLang, slug);
  const backLabel = uiLang === 'pt' ? 'Voltar aos tutoriais' : 'Back to tutorials';

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760, mx: 'auto', width: '100%' }}>
        <Button
          component={Link}
          href="/app/tutorials"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', mb: 3, px: 0 }}
        >
          {backLabel}
        </Button>

        {!tutorial ? (
          <Box sx={{ py: 6 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              {uiLang === 'pt' ? 'Tutorial não encontrado' : 'Tutorial not found'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {uiLang === 'pt'
                ? 'Esse guia não existe ou foi movido. Volte para a lista de tutoriais.'
                : 'This guide does not exist or was moved. Go back to the tutorials list.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.8px', mb: 1, fontSize: { xs: 28, md: 38 } }}>
              {tutorial.title}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip size="small" label={`${tutorial.readMinutes} ${uiLang === 'pt' ? 'min de leitura' : 'min read'}`} variant="outlined" sx={{ color: 'text.disabled' }} />
            </Stack>
            <Typography variant="subtitle1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
              {tutorial.summary}
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {tutorial.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            <Divider sx={{ my: 4 }} />
            <Button
              component={Link}
              href="/app/tutorials"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              {backLabel}
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
