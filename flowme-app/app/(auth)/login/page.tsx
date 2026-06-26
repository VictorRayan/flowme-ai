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
        perspective: '1200px',
        bgcolor: '#040711',
        '@keyframes flowWave': {
          '0%': { transform: 'translate3d(-10%, 12%, -80px) rotateX(64deg) rotateZ(-9deg) scale(1)', backgroundPosition: '0% 50%, 0 0' },
          '50%': { transform: 'translate3d(4%, -5%, 120px) rotateX(68deg) rotateZ(2deg) scale(1.08)', backgroundPosition: '100% 50%, 80px 32px' },
          '100%': { transform: 'translate3d(14%, -16%, -34px) rotateX(62deg) rotateZ(8deg) scale(1.03)', backgroundPosition: '0% 50%, -52px 64px' },
        },
        '@keyframes pointDrift': {
          '0%': { transform: 'translateX(-4%) translateY(0)' },
          '100%': { transform: 'translateX(4%) translateY(-18px)' },
        },
        '@keyframes flowPulse': {
          '0%,100%': { opacity: 0.52, filter: 'blur(0.2px) saturate(1.05)' },
          '50%': { opacity: 0.96, filter: 'blur(0px) saturate(1.35)' },
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: '-30%',
          background: [
            'radial-gradient(circle at 20% 30%, rgba(37,99,235,0.32), transparent 30%)',
            'radial-gradient(circle at 75% 35%, rgba(168,85,247,0.30), transparent 32%)',
            'radial-gradient(circle at 52% 70%, rgba(34,211,238,0.18), transparent 34%)',
            'linear-gradient(135deg, rgba(2,6,23,0.92), rgba(8,13,27,0.98))',
          ].join(','),
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          left: '-20%',
          right: '-20%',
          top: '34%',
          height: { xs: 240, sm: 330 },
          backgroundImage: [
            'radial-gradient(circle, rgba(219,234,254,0.95) 0 1.05px, transparent 1.38px)',
            'radial-gradient(circle, rgba(34,211,238,0.70) 0 0.8px, transparent 1.25px)',
            'linear-gradient(90deg, transparent, rgba(99,102,241,0.42), rgba(34,211,238,0.38), rgba(168,85,247,0.36), transparent)',
          ].join(','),
          backgroundSize: '18px 18px, 34px 34px, 260% 100%',
          maskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 74%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 74%, transparent)',
          filter: 'drop-shadow(0 0 34px rgba(99,102,241,0.50)) drop-shadow(0 0 52px rgba(34,211,238,0.20))',
          animation: 'flowWave 12s ease-in-out infinite alternate, flowPulse 5.5s ease-in-out infinite, pointDrift 7s ease-in-out infinite alternate',
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
