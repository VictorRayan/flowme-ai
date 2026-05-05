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
    <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
        Flow Me
      </Typography>
      <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
        Your productivity hub
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
          py: 1.5,
          bgcolor: '#4285F4',
          '&:hover': { bgcolor: '#3367D6' },
          textTransform: 'none',
          fontSize: '1rem',
        }}
      >
        {loading ? 'Redirecting...' : 'Sign in with Google'}
      </Button>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          By signing in, you grant Flow Me access to your Google Calendar
        </Typography>
      </Box>
    </Paper>
  );
}
