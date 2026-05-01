'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, List, ListItem, ListItemText,
  ListItemIcon, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Tooltip, Switch, Divider, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import DescriptionIcon from '@mui/icons-material/Description';
import GridOnIcon from '@mui/icons-material/GridOn';
import FolderIcon from '@mui/icons-material/Folder';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

type ConnectorType = 'gmail' | 'google_docs' | 'google_sheets' | 'google_drive';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
}

const CONNECTOR_META: Record<ConnectorType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  gmail: {
    label: 'Gmail',
    icon: <EmailIcon />,
    color: '#EA4335',
    description: 'Read emails and use them as context for Balys',
  },
  google_docs: {
    label: 'Google Docs',
    icon: <DescriptionIcon />,
    color: '#4285F4',
    description: 'Connect documents so Balys can reference them',
  },
  google_sheets: {
    label: 'Google Sheets',
    icon: <GridOnIcon />,
    color: '#0F9D58',
    description: 'Connect spreadsheets for financial or data context',
  },
  google_drive: {
    label: 'Google Drive',
    icon: <FolderIcon />,
    color: '#FBBC04',
    description: 'Connect a Drive folder to index its files',
  },
};

function ConnectorIcon({ type }: { type: ConnectorType }) {
  const meta = CONNECTOR_META[type];
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 2,
        bgcolor: alpha(meta.color, 0.12),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: meta.color,
        flexShrink: 0,
      }}
    >
      {meta.icon}
    </Box>
  );
}

function AddConnectorDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Connector) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ConnectorType>('gmail');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(''); setType('gmail'); setError(null); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create connector');
      onCreated(data.connector);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? handleClose : undefined} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add Connector</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl fullWidth>
            <InputLabel>Source type</InputLabel>
            <Select value={type} label="Source type" onChange={e => setType(e.target.value as ConnectorType)}>
              {(Object.keys(CONNECTOR_META) as ConnectorType[]).map(t => (
                <MenuItem key={t} value={t}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: CONNECTOR_META[t].color, display: 'flex' }}>{CONNECTOR_META[t].icon}</Box>
                    {CONNECTOR_META[t].label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Name"
            placeholder={`e.g. ${type === 'gmail' ? 'Work email' : type === 'google_sheets' ? 'Financial Sheet' : 'Contracts'}`}
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            helperText="Give this connector a descriptive name so Balys knows what it is"
          />
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {CONNECTOR_META[type].description}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim().length < 2}>
            {loading ? <CircularProgress size={18} /> : 'Add connector'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EditNameDialog({ connector, onClose, onUpdated }: { connector: Connector; onClose: () => void; onUpdated: (c: Connector) => void }) {
  const [name, setName] = useState(connector.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update');
      onUpdated(data.connector);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={!loading ? onClose : undefined} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Edit name</DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            autoFocus
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim().length < 2}>
            {loading ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ connector, onClose, onDeleted }: { connector: Connector; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to delete');
      onDeleted(connector.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={!loading ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle>Remove connector?</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          <strong>{connector.name}</strong> ({CONNECTOR_META[connector.type].label}) will be removed.
          Balys will no longer have access to this source.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load');
      setConnectors(data.connectors);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  const handleToggleActive = async (connector: Connector) => {
    setToggling(connector.id);
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !connector.is_active }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConnectors(prev => prev.map(c => c.id === connector.id ? data.connector : c));
      }
    } finally {
      setToggling(null);
    }
  };

  const grouped = (Object.keys(CONNECTOR_META) as ConnectorType[]).reduce<Record<ConnectorType, Connector[]>>(
    (acc, t) => { acc[t] = connectors.filter(c => c.type === t); return acc; },
    {} as any
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
            Connectors
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Connect your external sources so Balys can use them as context
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Add connector
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : connectors.length === 0 ? (
        /* Empty state */
        <Paper
          elevation={0}
          sx={{ p: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>No connectors yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Connect Gmail, Google Docs, Sheets or Drive so Balys can read and reference your data.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Add your first connector
          </Button>
        </Paper>
      ) : (
        /* List grouped by type */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(Object.keys(CONNECTOR_META) as ConnectorType[]).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const meta = CONNECTOR_META[type];
            return (
              <Paper key={type} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
                {/* Group header */}
                <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: alpha(meta.color, 0.06) }}>
                  <Box sx={{ color: meta.color, display: 'flex' }}>{meta.icon}</Box>
                  <Typography variant="subtitle2" fontWeight={700} color={meta.color}>
                    {meta.label}
                  </Typography>
                  <Chip label={items.length} size="small" sx={{ ml: 'auto', height: 20, fontSize: 11 }} />
                </Box>
                <Divider />
                <List disablePadding>
                  {items.map((connector, idx) => (
                    <React.Fragment key={connector.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        sx={{ px: 2.5, py: 1.5, opacity: connector.is_active ? 1 : 0.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title={connector.is_active ? 'Disable' : 'Enable'}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleActive(connector)}
                                  disabled={toggling === connector.id}
                                >
                                  {toggling === connector.id
                                    ? <CircularProgress size={16} />
                                    : <PowerSettingsNewIcon sx={{ fontSize: 18, color: connector.is_active ? 'success.main' : 'text.disabled' }} />
                                  }
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Edit name">
                              <IconButton size="small" onClick={() => setEditing(connector)}>
                                <EditIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove">
                              <IconButton size="small" onClick={() => setDeleting(connector)}>
                                <DeleteIcon sx={{ fontSize: 18, color: 'error.main' }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={connector.name}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                              <Chip
                                label={connector.is_active ? 'Active' : 'Disabled'}
                                size="small"
                                color={connector.is_active ? 'success' : 'default'}
                                sx={{ height: 18, fontSize: 10 }}
                              />
                              <Typography variant="caption" color="text.disabled">
                                Added {new Date(connector.created_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Dialogs */}
      <AddConnectorDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={c => setConnectors(prev => [...prev, c])}
      />
      {editing && (
        <EditNameDialog
          connector={editing}
          onClose={() => setEditing(null)}
          onUpdated={c => setConnectors(prev => prev.map(x => x.id === c.id ? c : x))}
        />
      )}
      {deleting && (
        <DeleteDialog
          connector={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={id => setConnectors(prev => prev.filter(c => c.id !== id))}
        />
      )}
    </Box>
  );
}
