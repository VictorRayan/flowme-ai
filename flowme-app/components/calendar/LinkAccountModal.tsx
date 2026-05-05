import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress, Typography, Box } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

interface LinkAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LinkAccountModal({ open, onClose, onSuccess }: LinkAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'work' | 'personal'>('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Create the linked account record in DB
      const res = await fetch('/api/linked-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to link account');
      }

      const accountId = data.account.id;

      // Step 2: Redirect to Google OAuth flow to connect the account
      // This will redirect the browser to Google's consent screen
      // After auth, Google will redirect back to /api/auth/google/callback
      // which stores the tokens and redirects to /app/settings
      window.location.href = `/api/auth/google/connect?linked_account_id=${accountId}`;

      // Reset form (user won't see this since we're redirecting)
      setName('');
      setType('personal');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Link Google Calendar</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <GoogleIcon sx={{ color: '#4285F4' }} />
            <Typography variant="body2" color="text.secondary">
              You will be redirected to Google to authorize calendar access after filling this form.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <TextField
            autoFocus
            margin="dense"
            label="Account Nickname"
            type="text"
            fullWidth
            variant="outlined"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="e.g. My Work Google, Personal Gmail"
            inputProps={{ minLength: 2 }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel id="account-type-label">Account Type</InputLabel>
            <Select
              labelId="account-type-label"
              value={type}
              onChange={(e) => setType(e.target.value as 'work' | 'personal')}
              label="Account Type"
            >
              <MenuItem value="personal">Personal</MenuItem>
              <MenuItem value="work">Work</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading} 
            startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
          >
            Connect with Google
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
