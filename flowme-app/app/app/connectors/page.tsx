'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';
import { intlLocale } from '@/lib/datetime';
import {
  Box, Typography, Button, Paper, List, ListItem, ListItemText,
  IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Tooltip, Divider, alpha, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import SlackBrandIcon from '@/components/icons/SlackBrandIcon';
import GmailBrandIcon from '@/components/icons/GmailBrandIcon';
import GoogleDocsBrandIcon from '@/components/icons/GoogleDocsBrandIcon';
import GoogleSheetsBrandIcon from '@/components/icons/GoogleSheetsBrandIcon';
import GoogleDriveBrandIcon from '@/components/icons/GoogleDriveBrandIcon';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

type ConnectorType = 'gmail' | 'google_docs' | 'google_sheets' | 'google_drive' | 'slack';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
}

const CONNECTOR_ICONS: Record<ConnectorType, React.ReactNode> = {
  gmail: <GmailBrandIcon />,
  google_docs: <GoogleDocsBrandIcon />,
  google_sheets: <GoogleSheetsBrandIcon />,
  google_drive: <GoogleDriveBrandIcon />,
  slack: <SlackBrandIcon />,
};

const CONNECTOR_COLORS: Record<ConnectorType, string> = {
  gmail: '#EA4335',
  google_docs: '#4285F4',
  google_sheets: '#0F9D58',
  google_drive: '#FBBC04',
  slack: '#4A154B',
};

const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  gmail: 'Gmail',
  google_docs: 'Google Docs',
  google_sheets: 'Google Sheets',
  google_drive: 'Google Drive',
  slack: 'Slack',
};

function getConnectorMeta(type: ConnectorType, uiLang: UiLang) {
  const t = UI[uiLang].connectors.connectorMeta;
  return {
    label: CONNECTOR_LABELS[type],
    icon: CONNECTOR_ICONS[type],
    color: CONNECTOR_COLORS[type],
    description: t[type].description,
    scopes: t[type].scopes,
  };
}

function isAuthorized(connector: Connector): boolean {
  return Boolean(connector.config?.linked_account_id) && connector.is_active;
}

function isPending(connector: Connector): boolean {
  return Boolean(connector.config?.linked_account_id) && !connector.is_active;
}

function friendlyConnectError(message: string, uiLang: UiLang): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('failed to create linked account') || normalized.includes('failed to start authorization')) {
    return uiLang === 'pt'
      ? 'Nao foi possivel iniciar a conexao com o Google. Tente novamente.'
      : 'Could not start the Google connection. Please try again.';
  }
  return message;
}

/* ── Add connector dialog ── */
function AddConnectorDialog({ open, onClose, onCreated, uiLang }: {
  open: boolean; onClose: () => void; onCreated: (c: Connector) => void; uiLang: UiLang;
}) {
  const [name, setName]           = useState(CONNECTOR_LABELS.gmail);
  const [type, setType]           = useState<ConnectorType>('gmail');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const t = UI[uiLang].connectors;

  const reset = () => { setName(CONNECTOR_LABELS.gmail); setType('gmail'); setError(null); };
  const handleClose = () => { reset(); onClose(); };
  const handleTypeChange = (nextType: ConnectorType) => {
    setName((prev) => {
      const wasDefault = prev.trim() === '' || prev === CONNECTOR_LABELS[type];
      return wasDefault ? CONNECTOR_LABELS[nextType] : prev;
    });
    setType(nextType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, config: {} }),
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

  const meta = getConnectorMeta(type, uiLang);

  return (
    <Dialog open={open} onClose={!loading ? handleClose : undefined} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t.addConnectorTitle}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl fullWidth>
            <InputLabel>{t.sourceType}</InputLabel>
            <Select value={type} label={t.sourceType} onChange={e => handleTypeChange(e.target.value as ConnectorType)}>
              {(Object.keys(CONNECTOR_ICONS) as ConnectorType[]).map(ct => {
                const m = getConnectorMeta(ct, uiLang);
                return (
                  <MenuItem key={ct} value={ct}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: m.color, display: 'flex' }}>{m.icon}</Box>
                      {m.label}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <TextField
            label={t.nameLabel}
            placeholder={`e.g. ${type === 'gmail' ? 'Work email' : type === 'google_sheets' ? 'Financial Sheet' : type === 'google_docs' ? 'Contracts' : type === 'slack' ? 'Work Slack' : 'My Drive'}`}
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            helperText={t.nameHelper}
          />
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {meta.description}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              {t.permissionsNeeded}: {meta.scopes}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block' }}>
              {t.accountWideAccess}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>{t.cancel}</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim().length < 2}>
            {loading ? <CircularProgress size={18} /> : t.addAndAuthorize}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ── Edit name dialog ── */
function EditNameDialog({ connector, onClose, onUpdated, uiLang }: {
  connector: Connector; onClose: () => void; onUpdated: (c: Connector) => void; uiLang: UiLang;
}) {
  const [name, setName] = useState(connector.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = UI[uiLang].connectors;

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
        <DialogTitle>{t.editName}</DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField label={t.nameLabel} value={name} onChange={e => setName(e.target.value)} fullWidth autoFocus required />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={loading}>{t.cancel}</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim().length < 2}>
            {loading ? <CircularProgress size={18} /> : t.save}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ── Delete dialog ── */
function DeleteDialog({ connector, onClose, onDeleted, uiLang }: {
  connector: Connector; onClose: () => void; onDeleted: (id: string) => void; uiLang: UiLang;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = UI[uiLang].connectors;

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
      <DialogTitle>{t.removeConnector}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          {t.removeBody(connector.name, CONNECTOR_LABELS[connector.type])}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>{t.cancel}</Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : t.remove}
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
  const [uiLang, setUiLang] = useState<UiLang>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => { if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = UI[uiLang].connectors;

  // Handle OAuth return params
  useEffect(() => {
    const connectedId = searchParams.get('connector_connected');
    const errorParam = searchParams.get('google_error') || searchParams.get('slack_error');
    if (connectedId) {
      setBanner({ type: 'success', message: t.authorizedSuccess });
      fetchConnectors();
      window.history.replaceState({}, '', '/app/connectors');
    } else if (errorParam) {
      setBanner({ type: 'error', message: t.authFailed(errorParam.replace(/_/g, ' ')) });
      window.history.replaceState({}, '', '/app/connectors');
    }
  }, [searchParams, t]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to start Google connection');
      window.location.href = data.redirect_url;
    } catch (err: any) {
      setError(friendlyConnectError(err.message, uiLang));
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

  const grouped = (Object.keys(CONNECTOR_ICONS) as ConnectorType[]).reduce<Record<ConnectorType, Connector[]>>(
    (acc, t) => { acc[t] = connectors.filter(c => c.type === t); return acc; },
    {} as any
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
            {t.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t.desc}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, flexShrink: 0, ml: 2 }}
        >
          {t.addConnector}
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
          <Typography variant="h6" fontWeight={600} gutterBottom>{t.noConnectors}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t.noConnectorsBody}
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t.addFirst}
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(Object.keys(CONNECTOR_ICONS) as ConnectorType[]).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const meta = getConnectorMeta(type, uiLang);
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
                                    label={t.connected}
                                    size="small"
                                    color="success"
                                    sx={{ height: 20, fontSize: 10 }}
                                  />
                                )}
                                {pending && (
                                  <Chip label={t.authPending} size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />
                                )}
                                {!authorized && !pending && (
                                  <Chip label={t.notConnected} size="small" color="default" sx={{ height: 20, fontSize: 10 }} />
                                )}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.disabled">
                                {t.added} {new Date(connector.created_at).toLocaleDateString(intlLocale(uiLang))}
                                {authorized && ` · ${t.balysCanRead}`}
                              </Typography>
                            }
                          />

                          {/* Action buttons */}
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1, flexShrink: 0 }}>
                            {authorized ? (
                              <>
                                <Tooltip title={t.reauthorize}>
                                  <span>
                                    <IconButton size="small" onClick={() => handleConnect(connector)} disabled={isConnecting}>
                                      {isConnecting ? <CircularProgress size={16} /> : <LinkIcon sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title={t.disconnect}>
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
                                {isConnecting ? t.redirecting : t.authorize}
                              </Button>
                            )}
                            <Tooltip title={t.editNameTooltip}>
                              <IconButton size="small" onClick={() => setEditing(connector)}>
                                <EditIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t.removeTooltip}>
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
        uiLang={uiLang}
      />
      {editing && (
        <EditNameDialog
          connector={editing}
          onClose={() => setEditing(null)}
          onUpdated={c => setConnectors(prev => prev.map(x => x.id === c.id ? c : x))}
          uiLang={uiLang}
        />
      )}
      {deleting && (
        <DeleteDialog
          connector={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={id => setConnectors(prev => prev.filter(c => c.id !== id))}
          uiLang={uiLang}
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
