'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Snackbar, Checkbox, FormControlLabel, FormGroup, Tooltip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';

const ALL_SCOPES = [
  { value: 'calendar.read', label: 'Calendar — Read', group: 'Calendar' },
  { value: 'calendar.write', label: 'Calendar — Write', group: 'Calendar' },
  { value: 'notes.read', label: 'Notes — Read', group: 'Notes' },
  { value: 'notes.write', label: 'Notes — Write', group: 'Notes' },
  { value: 'skills.read', label: 'Skills — Read', group: 'Skills' },
  { value: 'skills.write', label: 'Skills — Write', group: 'Skills' },
  { value: 'documents.read', label: 'Documents — Read', group: 'Documents' },
  { value: 'documents.write', label: 'Documents — Upload/Delete', group: 'Documents' },
  { value: '*', label: 'Full Access (all scopes)', group: 'Global' },
];

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [creating, setCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys');
      const data = await res.json();
      if (data.ok) setKeys(data.keys || []);
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim() || newKeyScopes.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: newKeyScopes,
          expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry) : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedKey(data.key.raw_key);
        setCreateOpen(false);
        setNewKeyName('');
        setNewKeyScopes([]);
        setNewKeyExpiry('');
        fetchKeys();
      } else {
        setSnackbar({ open: true, message: data.error?.message || 'Error creating key' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Network error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: keyId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSnackbar({ open: true, message: 'Key revoked' });
        fetchKeys();
      }
    } catch {
      setSnackbar({ open: true, message: 'Error revoking key' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copied to clipboard!' });
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <KeyIcon sx={{ fontSize: 28, color: '#a78bfa' }} />
          <Typography variant="h5" fontWeight={700}>API Keys</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }
          }}
        >
          Create Key
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        API keys allow external AI agents (Claude, GPT, etc.) to access your Flow Me data. 
        Keys are shown <strong>only once</strong> at creation — store them securely.
      </Typography>

      {/* MCP Discovery hint */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Connect your AI:</strong> Point it to the discovery endpoint:{' '}
        <code style={{ background: '#1e1e2e', padding: '2px 6px', borderRadius: 4, color: '#a78bfa' }}>
          GET /api/v1/mcp/discover
        </code>
      </Alert>

      {/* Created key display */}
      {createdKey && (
        <Alert
          severity="success"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <IconButton size="small" onClick={() => copyToClipboard(createdKey)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          }
          onClose={() => setCreatedKey(null)}
        >
          <Typography variant="subtitle2" gutterBottom>🔑 New API Key Created — Copy it now!</Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              background: '#1a1a2e',
              p: 1,
              borderRadius: 1,
              color: '#22c55e',
              wordBreak: 'break-all',
              cursor: 'pointer',
            }}
            onClick={() => copyToClipboard(createdKey)}
          >
            {createdKey}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            ⚠️ This key will NOT be shown again. Store it in a safe place.
          </Typography>
        </Alert>
      )}

      {/* Keys table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : keys.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <KeyIcon sx={{ fontSize: 48, color: '#555', mb: 1 }} />
          <Typography color="text.secondary">No API keys yet. Create one to connect external AIs.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Key</strong></TableCell>
                <TableCell><strong>Scopes</strong></TableCell>
                <TableCell><strong>Last Used</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.map(key => (
                <TableRow key={key.id} sx={{ opacity: key.is_active ? 1 : 0.5 }}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <code style={{ fontSize: 13 }}>{key.key_prefix}...</code>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {key.scopes.map(s => (
                        <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : <Typography variant="caption" color="text.secondary">Never</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={key.is_active ? 'Active' : 'Revoked'}
                      size="small"
                      color={key.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {key.is_active && (
                      <Tooltip title="Revoke Key">
                        <IconButton size="small" onClick={() => handleRevoke(key.id)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <TextField
            label="Key Name"
            placeholder="e.g. Claude Desktop, My GPT Agent"
            fullWidth
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Permissions</Typography>
          <FormGroup sx={{ mb: 2 }}>
            {ALL_SCOPES.map(scope => (
              <FormControlLabel
                key={scope.value}
                control={
                  <Checkbox
                    checked={newKeyScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {scope.label} <Typography component="span" variant="caption" color="text.secondary">({scope.value})</Typography>
                  </Typography>
                }
              />
            ))}
          </FormGroup>

          <TextField
            label="Expires in (days)"
            placeholder="Leave empty for no expiration"
            type="number"
            fullWidth
            value={newKeyExpiry}
            onChange={e => setNewKeyExpiry(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newKeyName.trim() || newKeyScopes.length === 0 || creating}
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              '&:hover': { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }
            }}
          >
            {creating ? <CircularProgress size={20} /> : 'Create Key'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
}
