'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthCallbackUrl } from '@/lib/auth/redirect';
import { Box, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

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
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        perspective: '900px',
        bgcolor: '#070a10',
        '@keyframes flowRibbon': {
          '0%': { transform: 'translate3d(-18%, 18%, -80px) rotateX(58deg) rotateZ(-18deg)' },
          '50%': { transform: 'translate3d(8%, -10%, 120px) rotateX(62deg) rotateZ(-8deg)' },
          '100%': { transform: 'translate3d(28%, -26%, -60px) rotateX(58deg) rotateZ(12deg)' },
        },
        '@keyframes flowPulse': {
          '0%,100%': { opacity: 0.42 },
          '50%': { opacity: 0.86 },
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: '-30%',
          background: 'radial-gradient(circle at 30% 40%, rgba(99,102,241,0.24), transparent 34%), radial-gradient(circle at 68% 52%, rgba(34,211,238,0.18), transparent 30%), linear-gradient(135deg, rgba(15,23,42,0.2), rgba(2,6,23,0.9))',
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          left: '-18%',
          top: '22%',
          width: '140%',
          height: 220,
          borderRadius: '999px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.08), rgba(34,211,238,0.28), rgba(167,139,250,0.18), transparent)',
          filter: 'blur(14px)',
          animation: 'flowRibbon 11s ease-in-out infinite alternate, flowPulse 5s ease-in-out infinite',
          transformStyle: 'preserve-3d',
        },
      }}
    />
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
      <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
        Your productivity ecosystem
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
        }}
      >
        {loading ? 'Redirecting...' : 'Sign in with Google'}
      </Button>
    </Paper>
    </>
  );
}
