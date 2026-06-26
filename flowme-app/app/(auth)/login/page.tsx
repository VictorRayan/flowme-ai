'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthCallbackUrl } from '@/lib/auth/redirect';
import { Box, Button, Typography, Paper, Alert, CircularProgress, Stack, Tooltip } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import EventIcon from '@mui/icons-material/Event';
import EmailIcon from '@mui/icons-material/Email';
import DescriptionIcon from '@mui/icons-material/Description';
import ForumIcon from '@mui/icons-material/Forum';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WaveBackground from '@/components/ui/WaveBackground';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthCallbackUrl(process.env.NEXT_PUBLIC_APP_URL, window.location.origin),
        scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // If no error, browser will redirect to Google
  };

  return (
    <>
      <WaveBackground />
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          p: 4,
          width: '100%',
          borderRadius: 3,
          border: '1px solid rgba(129,140,248,0.28)',
          bgcolor: 'rgba(17,24,39,0.82)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <Box
          component="img"
          src="/brand/flowme-icon.png"
          alt="Flow Me"
          sx={{ width: 110, height: 110, mx: 'auto', mb: 1, display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 0 22px rgba(99,102,241,0.26))' }}
        />
        <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
          Flow Me
        </Typography>
        
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 4, px: 1, lineHeight: 1.5 }}>
          To give our AI superpowers and autonomously manage your schedule, connect your Google account on your first login.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleGoogleLogin}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
          sx={{
            py: 1.55,
            borderRadius: 2,
            bgcolor: '#fff',
            color: '#111827',
            boxShadow: '0 14px 36px rgba(99,102,241,0.28)',
            '&:hover': { bgcolor: '#eef2ff', transform: 'translateY(-1px)', boxShadow: '0 18px 44px rgba(99,102,241,0.34)' },
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 800,
            transition: 'all 160ms ease',
            '& .MuiButton-startIcon svg': { fontSize: 23 },
            mb: 4
          }}
        >
          {loading ? 'Redirecting...' : 'Sign in with Google'}
        </Button>

        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', pt: 3 }}>
          <Typography variant="overline" display="block" align="center" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2, letterSpacing: 1 }}>
            INTEGRATED CAPABILITIES
          </Typography>
          <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Tooltip title="Calendar Sync" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <EventIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Calendar</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Email Briefings" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <EmailIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Gmail</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Document Access" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <DescriptionIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Drive</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Team Chat" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <ForumIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Slack</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Direct Messages" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <WhatsAppIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>WhatsApp</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Smart Assistant" arrow placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <AutoAwesomeIcon fontSize="small" sx={{ color: '#818cf8' }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Balys AI</Typography>
              </Box>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>
    </>
  );
}
