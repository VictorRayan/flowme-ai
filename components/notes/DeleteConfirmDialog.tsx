'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Alert
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;          // e.g. "Delete note"
  targetName: string;     // the name user must type
  confirmCount?: number;  // how many times to type it (default 1, people = 2)
  description?: string;
}

export default function DeleteConfirmDialog({
  open, onClose, onConfirm, title, targetName, confirmCount = 1, description
}: DeleteConfirmDialogProps) {
  const [inputs, setInputs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setInputs(Array(confirmCount).fill('')); setLoading(false); }
  }, [open, confirmCount]);

  const allMatch = inputs.length === confirmCount &&
    inputs.every(v => v.trim() === targetName.trim());

  const handleConfirm = async () => {
    if (!allMatch) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
        <WarningAmberIcon color="error" />
        {title}
      </DialogTitle>
      <DialogContent>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>
        )}
        <Alert severity="warning" sx={{ mb: 2 }}>
          This action <strong>cannot be undone</strong>.
          {confirmCount > 1 && ` Type the name ${confirmCount} times to confirm.`}
        </Alert>
        {Array.from({ length: confirmCount }).map((_, i) => (
          <Box key={i} sx={{ mb: i < confirmCount - 1 ? 2 : 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {confirmCount > 1
                ? `Type "${targetName}" (${i + 1}/${confirmCount})`
                : `Type "${targetName}" to confirm`}
            </Typography>
            <TextField
              fullWidth
              size="small"
              autoFocus={i === 0}
              value={inputs[i] || ''}
              onChange={e => setInputs(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
              onKeyDown={e => { if (e.key === 'Enter' && allMatch) handleConfirm(); }}
              error={inputs[i] !== undefined && inputs[i].length > 0 && inputs[i] !== targetName}
              placeholder={targetName}
            />
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!allMatch || loading}
          onClick={handleConfirm}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
