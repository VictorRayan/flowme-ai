'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, Button, Paper, List, ListItem, ListItemText,
  IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Tooltip, Divider, alpha, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import DescriptionIcon from '@mui/icons-material/Description';
import GridOnIcon from '@mui/icons-material/GridOn';
import FolderIcon from '@mui/icons-material/Folder';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

type ConnectorType = 'gmail' | 'google_docs' | 'google_sheets' | 'google_drive';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
}

const CONNECTOR_META: Record<ConnectorType, { label: string; icon: React.ReactNode; color: string; description: string; scopes: string }> = {
  gmail: {
    label: 'Gmail',
    icon: <EmailIcon />,
    color: '#EA4335',
    description: 'Read emails and use them as context for Balys',
    scopes: 'Read & draft emails',
  },
  google_docs: {
    label: 'Google Docs',
    icon: <DescriptionIcon />,
    color: '#4285F4',
    description: 'Connect documents so Balys can reference them',
    scopes: 'Read documents',
  },
  google_sheets: {
    label: 'Google Sheets',
    icon: <GridOnIcon />,
    color: '#0F9D58',
    description: 'Connect spreadsheets for financial or data context',
    scopes: 'Read spreadsheets',
  },
  google_drive: {
    label: 'Google Drive',
    icon: <FolderIcon />,
    color: '#FBBC04',
    description: 'Connect a Drive folder to index its files',
    scopes: 'Read Drive files',
  },
};

function isAuthorized(connector: Connector): boolean {
  return Boolean(connector.config?.linked_account_id) && connector.is_active;
}

function isPending(connector: Connector): boolean {
  return Boolean(connector.config?.linked_account_id) && !connector.is_active;
}

/* ── URL parsing helpers ── */
function extractGoogleId(url: string, type: ConnectorType): string | null {
  try {
    // spreadsheets/d/{id}, document/d/{id}, drive/folders/{id}
    const patterns: Record<string, RegExp> = {
      google_sheets: /spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      google_docs:   /document\/d\/([a-zA-Z0-9_-]+)/,
      google_drive:  /drive\/folders\/([a-zA-Z0-9_-]+)/,
    };
    const re = patterns[type];
    if (!re) return null;
    const m = url.match(re);
    return m ? m[1] : null;
  } catch { return null; }
}

function resourceUrlLabel(type: ConnectorType): string {
  if (type === 'google_sheets') return 'Spreadsheet URL';
  if (type === 'google_docs')   return 'Document URL';
  if (type === 'google_drive')  return 'Drive folder URL';
  return '';
}

function resourceUrlPlaceholder(type: ConnectorType): string {
  if (type === 'google_sheets') return 'https://docs.google.com/spreadsheets/d/…';
  if (type === 'google_docs')   return 'https://docs.google.com/document/d/…';
  if (type === 'google_drive')  return 'https://drive.google.com/drive/folders/…';
  return '';
}

function configKey(type: ConnectorType): string {
  if (type === 'google_sheets') return 'spreadsheet_id';
  if (type === 'google_docs')   return 'document_id';
  if (type === 'google_drive')  return 'folder_id';
  return '';
}

const NEEDS_URL: ConnectorType[] = ['google_sheets', 'google_docs', 'google_drive'];

/* ── Add connector dialog ── */
function AddConnectorDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (c: Connector) => void;
}) {
  const [name, setName]           = useState('');
  const [type, setType]           = useState<ConnectorType>('gmail');
  const [resourceUrl, setResourceUrl] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const needsUrl = NEEDS_URL.includes(type);

  const reset = () => { setName(''); setType('gmail'); setResourceUrl(''); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate URL and extract resource ID for non-Gmail types
    const config: Record<string, string> = {};
    if (needsUrl) {
      if (!resourceUrl.trim()) {
        setError(`Please paste the ${resourceUrlLabel(type)} so Balys knows which file to access.`);
        return;
      }
      const extracted = extractGoogleId(resourceUrl.trim(), type);
      if (!extracted) {
        setError(`Couldn't find a valid Google ID in that URL. Copy the URL directly from your browser address bar.`);
        return;
      }
      config[configKey(type)] = extracted;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, config }),
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
            <Select value={type} label="Source type" onChange={e => { setType(e.target.value as ConnectorType); setResourceUrl(''); }}>
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
            placeholder={`e.g. ${type === 'gmail' ? 'Work email' : type === 'google_sheets' ? 'Financial Sheet' : type === 'google_docs' ? 'Contracts' : 'My Drive'}`}
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            helperText="Give this connector a descriptive name so Balys knows what it is"
          />
          {needsUrl && (
            <TextField
              label={resourceUrlLabel(type)}
              placeholder={resourceUrlPlaceholder(type)}
              value={resourceUrl}
              onChange={e => setResourceUrl(e.target.value)}
              fullWidth
              required
              helperText="Paste the URL from your browser. Balys uses this to know exactly which file to read."
            />
          )}
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {CONNECTOR_META[type].description}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              Permissions needed: {CONNECTOR_META[type].scopes}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim().length < 2}>
            {loading ? <CircularProgress size={18} /> : 'Add & authorize'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ── Edit name dialog ── */
function EditNameDialog({ connector, onClose, onUpdated }: {
  connector: Connector; onClose: () => void; onUpdated: (c: Connector) => void;
}) {
  const [name, setName] = useState(connector.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth autoFocus required />
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

/* ── Delete dialog ── */
function DeleteDialog({ connector, onClose, onDeleted }: {
  connector: Connector; onClose: () => void; onDeleted: (id: string) => void;
}) {
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
          <strong>{connector.name}</strong> ({CONNECTOR_META[connector.type].label}) will be removed and disconnected.
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

/* ── Main page ── */
function ConnectorsContent() {
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Handle OAuth return params
  useEffect(() => {
    const connectedId = searchParams.get('connector_connected');
    const errorParam = searchParams.get('google_error');
    if (connectedId) {
      setBanner({ type: 'success', message: 'Connector authorized successfully. Balys can now access this source.' });
      fetchConnectors();
      window.history.replaceState({}, '', '/app/connectors');
    } else if (errorParam) {
      setBanner({ type: 'error', message: `Authorization failed: ${errorParam.replace(/_/g, ' ')}. Please try again.` });
      window.history.replaceState({}, '', '/app/connectors');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleConnect = async (connector: Connector) => {
    setConnecting(connector.id);
    try {
      const res = await fetch(`/api/connectors/${connector.id}/connect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to start authorization');
      // Redirect to Google OAuth
      window.location.href = data.redirect_url;
    } catch (err: any) {
      setError(err.message);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connector: Connector) => {
    setDisconnecting(connector.id);
    try {
      const res = await fetch(`/api/connectors/${connector.id}/disconnect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to disconnect');
      setConnectors(prev => prev.map(c => c.id === connector.id ? data.connector : c));
      setBanner({ type: 'success', message: `${connector.name} disconnected.` });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDisconnecting(null);
    }
  };

  const grouped = (Object.keys(CONNECTOR_META) as ConnectorType[]).reduce<Record<ConnectorType, Connector[]>>(
    (acc, t) => { acc[t] = connectors.filter(c => c.type === t); return acc; },
    {} as any
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
            Connectors
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Connect your external sources so Balys can use them as context. Each connector requires a one-time Google authorization.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, flexShrink: 0, ml: 2 }}
        >
          Add connector
        </Button>
      </Box>

      {banner && (
        <Alert
          severity={banner.type}
          onClose={() => setBanner(null)}
          sx={{ mb: 3 }}
          icon={banner.type === 'success' ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
        >
          {banner.message}
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : connectors.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>No connectors yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Connect Gmail, Google Docs, Sheets or Drive so Balys can read and reference your data.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Add your first connector
          </Button>
        </Paper>
      ) : (
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
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} color={meta.color}>{meta.label}</Typography>
                    <Typography variant="caption" color="text.disabled">{meta.scopes}</Typography>
                  </Box>
                  <Chip label={items.length} size="small" sx={{ height: 20, fontSize: 11 }} />
                </Box>
                <Divider />
                <List disablePadding>
                  {items.map((connector, idx) => {
                    const authorized = isAuthorized(connector);
                    const pending = isPending(connector);
                    const isConnecting = connecting === connector.id;
                    const isDisconnecting = disconnecting === connector.id;

                    return (
                      <React.Fragment key={connector.id}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem sx={{ px: 2.5, py: 1.5 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography fontWeight={500}>{connector.name}</Typography>
                                {authorized && (
                                  <Chip
                                    icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                                    label="Connected"
                                    size="small"
                                    color="success"
                                    sx={{ height: 20, fontSize: 10 }}
                                  />
                                )}
                                {pending && (
                                  <Chip label="Auth pending" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />
                                )}
                                {!authorized && !pending && (
                                  <Chip label="Not connected" size="small" color="default" sx={{ height: 20, fontSize: 10 }} />
                                )}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.disabled">
                                Added {new Date(connector.created_at).toLocaleDateString()}
                                {authorized && ' · Balys can read this source'}
                              </Typography>
                            }
                          />

                          {/* Action buttons */}
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1, flexShrink: 0 }}>
                            {authorized ? (
                              <>
                                <Tooltip title="Re-authorize (refresh token)">
                                  <span>
                                    <IconButton size="small" onClick={() => handleConnect(connector)} disabled={isConnecting}>
                                      {isConnecting ? <CircularProgress size={16} /> : <LinkIcon sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Disconnect">
                                  <span>
                                    <IconButton size="small" onClick={() => handleDisconnect(connector)} disabled={isDisconnecting}>
                                      {isDisconnecting ? <CircularProgress size={16} /> : <LinkOffIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={isConnecting ? <CircularProgress size={13} /> : <LinkIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleConnect(connector)}
                                disabled={isConnecting}
                                sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5 }}
                              >
                                {isConnecting ? 'Redirecting…' : 'Authorize'}
                              </Button>
                            )}
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
                          </Stack>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
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
        onCreated={c => { setConnectors(prev => [...prev, c]); handleConnect(c); }}
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

export default function ConnectorsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }>
      <ConnectorsContent />
    </Suspense>
  );
}
