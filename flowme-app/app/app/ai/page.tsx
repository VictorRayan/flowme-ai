'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, TextField, IconButton, Typography, Paper, Stack,
  Chip, Divider, CircularProgress, Alert, Tooltip, Avatar,
  List, ListItemButton, ListItemText, Drawer,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HistoryIcon from '@mui/icons-material/History';
import NoteIcon from '@mui/icons-material/Note';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import EmailIcon from '@mui/icons-material/Email';
import DescriptionIcon from '@mui/icons-material/Description';
import GridOnIcon from '@mui/icons-material/GridOn';
import FolderIcon from '@mui/icons-material/Folder';
import CommandPalette, { ContextItem, type CommandAction } from '@/components/ai/CommandPalette';
import BalysMarkdown from '@/components/markdown/BalysMarkdown';
import { UI, resolveUiLang } from '@/lib/i18n';

// ── Note edit block parsing ───────────────────────────────────────────────────
const NOTE_EDIT_RE = /%%NOTE_EDIT_START(?::([^%]+))?%%([\s\S]*?)%%NOTE_EDIT_END%%/g;

interface NoteEditBlock { noteId: string; noteTitle: string; html: string; }

function parseNoteEdits(text: string): { clean: string; edits: NoteEditBlock[] } {
  const edits: NoteEditBlock[] = [];
  const clean = text.replace(NOTE_EDIT_RE, (_, meta, html) => {
    const [noteId, ...rest] = (meta || '').split('|');
    edits.push({ noteId: noteId?.trim() || '', noteTitle: rest.join('|').trim() || 'Note', html: html.trim() });
    return '';
  }).trim();
  return { clean, edits };
}

// ── Note edit preview card ────────────────────────────────────────────────────
function NoteEditCard({ block, onApply, labels }: { block: NoteEditBlock; onApply: (b: NoteEditBlock) => Promise<void>; labels: { noteEditPreview: string; applied: string; applying: string; applyToNote: string; viewNote: string } }) {
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(block);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5, border: '1px solid', borderColor: 'rgba(99,102,241,0.35)', borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(99,102,241,0.04)' }}>
      {/* Card header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(99,102,241,0.08)' }}>
        <EditNoteIcon sx={{ fontSize: 15, color: '#818cf8' }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#818cf8', flex: 1, fontSize: 11, letterSpacing: '0.04em' }}>
          {labels.noteEditPreview} — {block.noteTitle}
        </Typography>
        <Box
          onClick={applied ? undefined : handleApply}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1.25, py: '4px', borderRadius: 1.5,
            bgcolor: applied ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.2)',
            border: '1px solid', borderColor: applied ? 'rgba(52,211,153,0.4)' : 'rgba(99,102,241,0.4)',
            cursor: applied ? 'default' : 'pointer',
            transition: 'all 120ms',
            '&:hover': applied ? {} : { bgcolor: 'rgba(99,102,241,0.3)' },
          }}
        >
          {applying ? (
            <CircularProgress size={11} sx={{ color: '#818cf8' }} />
          ) : applied ? (
            <CheckCircleIcon sx={{ fontSize: 13, color: '#34d399' }} />
          ) : (
            <CheckCircleIcon sx={{ fontSize: 13, color: '#818cf8' }} />
          )}
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: applied ? '#34d399' : '#818cf8' }}>
            {applied ? labels.applied : applying ? labels.applying : labels.applyToNote}
          </Typography>
        </Box>
        {/* View note button */}
        {block.noteId && (
          <Box
            component="a"
            href={`/app/notes`}
            target="_blank"
            rel="noopener"
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1.25, py: '4px', borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid', borderColor: 'rgba(255,255,255,0.15)',
              cursor: 'pointer', textDecoration: 'none',
              transition: 'all 120ms',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
          >
            <NoteIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
              {labels.viewNote}
            </Typography>
          </Box>
        )}
      </Box>
      {/* HTML preview */}
      <Box
        sx={{
          px: 2, py: 1.5, maxHeight: 320, overflowY: 'auto',
          fontSize: 13, lineHeight: 1.7, color: 'text.primary',
          '& h1,& h2,& h3': { mt: 1, mb: 0.5, fontWeight: 700, color: 'text.primary' },
          '& h2': { fontSize: '1em', color: '#a5b4fc' },
          '& h3': { fontSize: '0.95em' },
          '& p': { my: 0.5 },
          '& ul,& ol': { pl: 2.5, my: 0.5 },
          '& li': { mb: 0.25 },
          '& strong': { fontWeight: 700, color: 'text.primary' },
          '& em': { fontStyle: 'italic', opacity: 0.85 },
          '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 1.5 },
          '& code': { fontFamily: 'monospace', fontSize: 12, bgcolor: 'rgba(30,36,51,0.9)', color: '#c084fc', px: 0.5, borderRadius: 0.5 },
          '& blockquote': { borderLeft: '3px solid #6366f1', pl: 1.5, ml: 0, opacity: 0.8 },
        }}
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </Box>
  );
}

const STORAGE_KEY_THREADS  = 'balysai_threads';

interface Attachment { type: 'image' | 'file' | 'audio'; name: string; dataUrl?: string; mimeType: string; url?: string; }
interface ThinkingStep {
  call_id: string;
  tool: string;
  args?: any;
  status: 'running' | 'ok' | 'failed';
  receipt?: any;
  error?: string;
  preliminary_text?: string;
}
interface SelectedActionMeta { id: string; label: string; action: CommandAction; }
interface Message { role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; transcript?: string; thinking?: ThinkingStep[]; selectedAction?: SelectedActionMeta; }
type DestructiveDialog =
  | { kind: 'deleteThread'; threadId: string; title: string; step: 1 | 2 }
  | { kind: 'clearThread'; threadId: string; title: string; step: 1 | 2 }
  | null;
interface Thread {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  provider: string;
  tier: string;
  routeLabel: string;
  executionPlan: string;
  createdAt: number;
}

function genThreadId(): string {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // Fallback for older runtimes (very rare in 2026): RFC4122-ish.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function newThread(): Thread {
  return {
    id: genThreadId(),
    title: 'New chat',
    messages: [],
    model: 'shadow-router',
    provider: 'auto',
    tier: 'cheap',
    routeLabel: 'Shadow Router',
    executionPlan: 'direct_tool',
    createdAt: Date.now(),
  };
}

function normalizeThread(thread: Partial<Thread>): Thread {
  const base = newThread();
  return {
    ...base,
    ...thread,
    messages: Array.isArray(thread.messages) ? thread.messages : [],
  };
}

function isWhatsAppThread(thread: Pick<Thread, 'title'> | null | undefined): boolean {
  return (thread?.title || '').trim().toLowerCase() === 'whatsapp';
}

function mapPersistedMessage(m: any): Message {
  return {
    role: m.role,
    content: m.content || '',
    attachments: Array.isArray(m.attachments)
      ? m.attachments.map((a: any) => ({ ...a, dataUrl: '' }))
      : undefined,
    selectedAction: m.selected_action || undefined,
    transcript: m.transcript || undefined,
    thinking: Array.isArray(m.thinking) ? m.thinking : undefined,
  };
}

function stripThreadAttachmentData(t: Thread[]): Thread[] {
  return t.map(thread => ({
    ...thread,
    messages: thread.messages.map(msg =>
      msg.attachments?.length
        ? { ...msg, attachments: msg.attachments.map(att => ({ ...att, dataUrl: '' })) }
        : msg
    ),
  }));
}

function pendingActionIcon(action: CommandAction): React.ReactElement | undefined {
  const iconSx = { fontSize: '14px !important' };
  if (action === 'weather') return <WbSunnyIcon sx={iconSx} />;
  if (action === 'gmail') return <EmailIcon sx={iconSx} />;
  if (action === 'drive') return <FolderIcon sx={iconSx} />;
  if (action === 'docs') return <DescriptionIcon sx={iconSx} />;
  if (action === 'sheets') return <GridOnIcon sx={iconSx} />;
  if (action === 'note') return <EditNoteIcon sx={iconSx} />;
  if (action === 'reminder') return <NotificationsActiveIcon sx={iconSx} />;
  if (action === 'image') return <ImageIcon sx={iconSx} />;
  return undefined;
}

export default function AIPage() {
  const [threads, setThreads]         = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording]     = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // / command palette
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<{ id: string; label: string; directive: string; action: CommandAction } | null>(null);
  const [destructiveDialog, setDestructiveDialog] = useState<DestructiveDialog>(null);
  const [uiLang, setUiLang] = useState<Lang>('en');
  const [interfaceLang, setInterfaceLang] = useState<'en' | 'pt'>('en');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('balysai_language') : null;
    setUiLang(resolveLang(stored));
    const storedUi = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setInterfaceLang(resolveUiLang(storedUi));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'balysai_language') setUiLang(resolveLang(e.newValue));
      if (e.key === 'ui_language') setInterfaceLang(resolveUiLang(e.newValue));
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage); };
  }, []);

  // Request browser GPS once on mount. Tracks permission state so the weather
  // action can show a nudge if the user denied location access.
  const requestGps = React.useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationPermission('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationPermission('granted');
      },
      () => setLocationPermission('denied'),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  useEffect(() => { requestGps(); }, [requestGps]);
  const inputBoxRef = useRef<HTMLDivElement>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt');
    if (prompt) setInput(prompt);
    if (params.get('autofocus') === '1') {
      window.setTimeout(() => inputBoxRef.current?.querySelector('textarea')?.focus(), 0);
    }
  }, []);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;
  const activeIsWhatsAppThread = isWhatsAppThread(activeThread);
  const refreshThreadMessages = useCallback(async (threadId: string) => {
    if (!UUID_RE.test(threadId)) return;
    const res = await fetch(`/api/threads/${threadId}`);
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.ok || !Array.isArray(data.messages) || data.messages.length === 0) return;
    const msgs: Message[] = data.messages.map(mapPersistedMessage);
    setThreads((prev) => {
      const updated = prev.map((t) => t.id === threadId ? { ...t, messages: msgs } : t);
      try { localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(stripThreadAttachmentData(updated))); } catch {}
      return updated;
    });
  }, []);

  // Hydrate threads: prefer server, fall back to localStorage cache, run one-shot backfill if needed.
  useEffect(() => {
    let cancelled = false;

    const readLocal = (): Thread[] => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_THREADS) || '[]') as Partial<Thread>[];
        return saved.length > 0 ? saved.map(normalizeThread) : [];
      } catch {
        return [];
      }
    };

    const migrateLocalIds = (list: Thread[]): { migrated: Thread[]; changed: boolean } => {
      let changed = false;
      const migrated = list.map((t) => {
        if (UUID_RE.test(t.id)) return t;
        changed = true;
        return { ...t, id: genThreadId() };
      });
      return { migrated, changed };
    };

    const init = async () => {
      let serverThreads: Thread[] = [];
      try {
        const res = await fetch('/api/threads');
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && Array.isArray(data.threads)) {
            serverThreads = (data.threads as any[]).map((t) => normalizeThread({
              id: t.id,
              title: t.title,
              messages: [],
              model: t.model,
              provider: t.provider,
              tier: t.tier,
              routeLabel: t.route_label,
              executionPlan: t.execution_plan,
              createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
            }));
          }
        }
      } catch {
        // offline or error — fall through to localStorage
      }
      if (cancelled) return;

      let localThreads = readLocal();
      const { migrated, changed } = migrateLocalIds(localThreads);
      if (changed) {
        localThreads = migrated;
        try { localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(localThreads)); } catch {}
      }

      // Decide source of truth:
      // - Server has rows → use server list, but enrich each with cached messages from localStorage when ids match.
      // - Server empty AND local has threads → backfill localStorage to server (one-shot), then use local.
      // - Both empty → start fresh.
      const alreadyMigrated = localStorage.getItem('balysai_threads_migrated') === '1';

      if (serverThreads.length > 0) {
        const localById = new Map(localThreads.map((t) => [t.id, t]));
        const merged = serverThreads.map((s) => ({
          ...s,
          messages: localById.get(s.id)?.messages || [],
        }));
        if (!cancelled) {
          setThreads(merged);
          setActiveThreadId(merged[0].id);
        }
        return;
      }

      if (!alreadyMigrated && localThreads.length > 0) {
        try {
          const res = await fetch('/api/threads/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threads: localThreads }),
          });
          if (res.ok) localStorage.setItem('balysai_threads_migrated', '1');
        } catch {
          // best-effort; will retry on next mount
        }
      }
      if (cancelled) return;

      if (localThreads.length > 0) {
        setThreads(localThreads);
        setActiveThreadId(localThreads[0].id);
      } else {
        const t = newThread();
        setThreads([t]);
        setActiveThreadId(t.id);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    const active = threads.find((t) => t.id === activeThreadId);
    if (!active || !UUID_RE.test(activeThreadId)) return;

    refreshThreadMessages(activeThreadId).catch(() => { /* ignore */ });
  }, [activeThreadId, refreshThreadMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeThreadId || !activeIsWhatsAppThread || !UUID_RE.test(activeThreadId)) return;
    let stopped = false;
    const poll = () => {
      if (stopped || document.visibilityState === 'hidden') return;
      refreshThreadMessages(activeThreadId).catch(() => { /* ignore */ });
    };
    const interval = window.setInterval(poll, 4000);
    const onVisibility = () => poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeThreadId, activeIsWhatsAppThread, refreshThreadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeThread?.messages, loading]);

  const persistThreads = (t: Thread[]) => {
    // Strip attachment dataUrls (base64) before persisting — they blow the localStorage quota
    const stripped = stripThreadAttachmentData(t);
    try {
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(stripped));
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(stripped.map(th => ({ ...th, messages: [] }))));
      } catch { /* give up */ }
    }
  };

  const applyNoteEdit = async (block: NoteEditBlock) => {
    const res = await fetch(`/api/notes/${block.noteId}/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: block.html }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to apply note edit');
    }
  };

  const saveThreads = (t: Thread[]) => {
    setThreads(t);
    persistThreads(t);
  };

  const newChat = () => {
    const t = newThread();
    saveThreads([t, ...threads]);
    setActiveThreadId(t.id);
    setError(null);
  };

  const requestDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const thread = threads.find(t => t.id === id);
    setDestructiveDialog({
      kind: 'deleteThread',
      threadId: id,
      title: thread?.title || 'chat',
      step: 1,
    });
  };

  const deleteThread = (id: string) => {
    const updated = threads.filter(t => t.id !== id);
    if (updated.length === 0) { const t = newThread(); saveThreads([t]); setActiveThreadId(t.id); }
    else { saveThreads(updated); if (activeThreadId === id) setActiveThreadId(updated[0].id); }
    if (UUID_RE.test(id)) {
      fetch(`/api/threads/${id}`, { method: 'DELETE' }).catch(() => { /* offline ok */ });
    }
  };

  const requestClearActiveThread = () => {
    if (!activeThread || !activeThreadId) return;
    setDestructiveDialog({
      kind: 'clearThread',
      threadId: activeThreadId,
      title: activeThread.title || 'chat',
      step: 1,
    });
  };

  const clearThreadMessages = (id: string) => {
    saveThreads(threads.map(t => t.id === id ? { ...t, messages: [], title: 'New chat' } : t));
  };

  const confirmDestructiveAction = () => {
    if (!destructiveDialog) return;
    if (destructiveDialog.step === 1) {
      setDestructiveDialog({ ...destructiveDialog, step: 2 });
      return;
    }
    if (destructiveDialog.kind === 'deleteThread') deleteThread(destructiveDialog.threadId);
    if (destructiveDialog.kind === 'clearThread') clearThreadMessages(destructiveDialog.threadId);
    setDestructiveDialog(null);
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setAttachments(prev => [...prev, { type, name: file.name, dataUrl: reader.result as string, mimeType: file.type }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const imageItems: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageItems.push(file);
      }
    }
    if (imageItems.length === 0) return;

    e.preventDefault();
    imageItems.forEach((file, idx) => {
      const reader = new FileReader();
      const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const name = file.name && file.name.trim() ? file.name : `pasted-${Date.now()}-${idx}.${ext}`;
      reader.onload = () => setAttachments(prev => [...prev, { type: 'image', name, dataUrl: reader.result as string, mimeType: file.type || 'image/png' }]);
      reader.readAsDataURL(file);
    });
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => setAttachments(prev => [...prev, { type: 'audio', name: `rec-${Date.now()}.webm`, dataUrl: reader.result as string, mimeType: 'audio/webm' }]);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setMediaRecorder(mr); setRecording(true);
    } catch { setError('Microphone access denied'); }
  };

  const stopRecording = () => { mediaRecorder?.stop(); setRecording(false); setMediaRecorder(null); };

  const handleInputChange = (val: string) => {
    setInput(val);
    // Detect "/" at start or after whitespace to open command palette
    const match = val.match(/(^|\s)\/(\S*)$/);
    if (match) {
      setCmdQuery(match[2]);
      setCmdOpen(true);
    } else {
      setCmdOpen(false);
    }
  };

  const handleContextSelect = (item: ContextItem) => {
    // Remove the trailing /query from input and close palette
    setInput(prev => prev.replace(/(^|\s)\/\S*$/, (m, space) => space));
    if (item.kind === 'action' && item.action) {
      setPendingAction({ id: item.id, label: item.label, directive: item.content, action: item.action });
      // If weather selected and we don't have location yet, re-attempt GPS prompt.
      // The browser will ask if it hasn't been decided yet; if already denied it
      // stays 'denied' and we show the nudge banner instead.
      if (item.action === 'weather' && locationPermission !== 'granted') {
        requestGps();
      }
    } else {
      setContextItems(prev => prev.find(c => c.id === item.id) ? prev : [...prev, item]);
    }
    setCmdOpen(false);
    setCmdQuery('');
  };

  const removeContext = (id: string) => setContextItems(prev => prev.filter(c => c.id !== id));

  const sendMessage = async () => {
    if (activeIsWhatsAppThread) return;
    if ((!input.trim() && attachments.length === 0 && contextItems.length === 0 && !pendingAction) || loading || !activeThread) return;

    const rawUserInput = input.trim();
    let messageContent = rawUserInput;

    if (contextItems.length > 0) {
      const noteItems = contextItems.filter(c => c.kind === 'note');
      const eventItems = contextItems.filter(c => c.kind === 'event');

      let contextBlock = '';

      // For notes: trigger embedding + semantic retrieval if query exists
      if (noteItems.length > 0 && messageContent) {
        try {
          // 1. Ensure all selected notes have embeddings (lazy, cached)
          await Promise.all(noteItems.map(n =>
            fetch(`/api/notes/${n.id}/embed`, { method: 'POST' })
          ));

          // 2. Find most relevant chunks from selected notes given the query
          const simRes = await fetch('/api/notes/similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: messageContent, note_ids: noteItems.map(n => n.id), top_k: 4 }),
          });

          if (simRes.ok) {
            const { notes: relevant } = await simRes.json();
            if (relevant?.length) {
              contextBlock += relevant.map((n: { title: string; note_date?: string; content_text: string; similarity: number }) =>
                `--- Note: ${n.title}${n.note_date ? ` (${n.note_date})` : ''} [relevance: ${n.similarity}] ---\n${n.content_text || '(empty)'}`
              ).join('\n\n');
            }
          }
        } catch {
          // Fallback to full text if embedding fails
          contextBlock += noteItems.map(c => `--- Note: ${c.label} ---\n${c.content}`).join('\n\n');
        }
      } else if (noteItems.length > 0) {
        // No query text — just include full note content
        contextBlock += noteItems.map(c => `--- Note: ${c.label} ---\n${c.content}`).join('\n\n');
      }

      // Events always injected as-is (they're short structured data)
      if (eventItems.length > 0) {
        if (contextBlock) contextBlock += '\n\n';
        contextBlock += eventItems.map(c => `--- Event: ${c.label} ---\n${c.content}`).join('\n\n');
      }

      if (contextBlock) {
        messageContent = contextBlock + (messageContent ? '\n\n' + messageContent : '');
      }
    }

    // Build note-edit system addendum for notes in context
    const noteItems = contextItems.filter(c => c.kind === 'note');
    const defaultNoteId = noteItems[0]?.id || '';
    const defaultNoteTitle = noteItems[0]?.label || '';
    const noteEditSystemPrompt = noteItems.length > 0
      ? `You can edit notes. When the user asks you to add, update, or modify a note's content, output the new HTML content as a block using this exact format (replace NOTE_ID and NOTE_TITLE with the actual values):

%%NOTE_EDIT_START:NOTE_ID|NOTE_TITLE%%
<h2>Section heading</h2>
<p>Content here...</p>
%%NOTE_EDIT_END%%

Available notes (use the exact id):
${noteItems.map(n => `- id: ${n.id} | title: ${n.label}`).join('\n')}

Default note to edit if unspecified: id="${defaultNoteId}" title="${defaultNoteTitle}"

Rules:
- Only output a NOTE_EDIT block when explicitly asked to add/edit/update a note
- Use exactly one NOTE_EDIT block per response; the id must match one of the available note ids above
- Outside the block, write a brief one-line summary of what you added
- Use ONLY these HTML tags inside the block: <h2><h3><p><strong><em><ul><li><ol><code><blockquote><hr> — no divs, no wrappers`
      : '';

    const actionDirective = pendingAction
      ? `The user invoked the ${pendingAction.label} command. ${pendingAction.directive}`
      : '';
    const combinedAddendum = [actionDirective, noteEditSystemPrompt].filter(s => s && s.trim()).join('\n\n');

    const selectedAction = pendingAction
      ? { id: pendingAction.id, label: pendingAction.label, action: pendingAction.action }
      : undefined;
    const userMsg: Message = { role: 'user', content: messageContent, attachments, selectedAction };
    const newMessages = [...activeThread.messages, userMsg];
    const title = activeThread.title === 'New chat' && input.trim()
      ? input.trim().slice(0, 40)
      : activeThread.title;

    const updatedThread: Thread = { ...activeThread, messages: newMessages, title };
    saveThreads(threads.map(t => t.id === activeThreadId ? updatedThread : t));

    setInput(''); setAttachments([]); setContextItems([]); setCmdOpen(false); setPendingAction(null); setLoading(true); setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-thread-id': activeThreadId || '',
        },
        body: JSON.stringify({
          messages: newMessages,
          language: localStorage.getItem('balysai_language') || 'en',
          systemAddendum: combinedAddendum,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientNowIso: new Date().toISOString(),
          rawUserInput,
          connectorIntent: selectedAction,
          userLocation: userLocation ?? undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        try { const e = JSON.parse(text); throw new Error(e.error?.message || e.error || text); }
        catch (pe) { if (pe instanceof SyntaxError) throw new Error(text || 'Request failed'); else throw pe; }
      }

      const routedProvider = res.headers.get('x-balys-provider') || updatedThread.provider;
      const routedModel = res.headers.get('x-balys-model') || updatedThread.model;
      const routedTier = res.headers.get('x-balys-tier') || updatedThread.tier;
      const routedLabel = res.headers.get('x-balys-route-label') || updatedThread.routeLabel;
      const routedPlan = res.headers.get('x-balys-execution-plan') || updatedThread.executionPlan;

      const transcriptHeader = res.headers.get('x-balys-transcript');
      const transcriptEncoding = res.headers.get('x-balys-transcript-encoding');
      let decodedTranscript = '';
      if (transcriptHeader) {
        try {
          decodedTranscript = transcriptEncoding === 'base64-utf8'
            ? new TextDecoder('utf-8').decode(Uint8Array.from(atob(transcriptHeader), c => c.charCodeAt(0)))
            : transcriptHeader;
        } catch {
          decodedTranscript = '';
        }
      }
      if (decodedTranscript && newMessages.length > 0) {
        const last = newMessages[newMessages.length - 1];
        if (last.role === 'user') {
          newMessages[newMessages.length - 1] = { ...last, transcript: decodedTranscript };
        }
      }

      const routedThread: Thread = {
        ...updatedThread,
        messages: newMessages,
        provider: routedProvider,
        model: routedModel,
        tier: routedTier,
        routeLabel: routedLabel,
        executionPlan: routedPlan,
      };

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const thinking: ThinkingStep[] = [];
      const assistantAttachments: Attachment[] = [];
      let pendingPreliminaryText = '';
      const isSse = (res.headers.get('x-balys-stream-format') || '').toLowerCase() === 'sse';

      const withAssistant = [...newMessages, { role: 'assistant' as const, content: '', thinking: [] as ThinkingStep[] }];
      saveThreads(threads.map(t => t.id === activeThreadId ? { ...routedThread, messages: withAssistant } : t));

      const pushUiUpdate = () => {
        setThreads(prev => {
          const updated = prev.map(t => {
            if (t.id !== activeThreadId) return t;
            const msgs = [...newMessages, { role: 'assistant' as const, content: assistantText, thinking: [...thinking], attachments: [...assistantAttachments] }];
            return { ...t, ...routedThread, messages: msgs };
          });
          // Strip attachment dataUrls before persisting to avoid quota errors
          const stripped = updated.map(t => ({
            ...t,
            messages: t.messages.map(msg =>
              msg.attachments
                ? { ...msg, attachments: msg.attachments.map(att => ({ ...att, dataUrl: '' })) }
                : msg
            ),
          }));
          try {
            localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(stripped));
          } catch {
            try {
              localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(stripped.map(th => ({ ...th, messages: [] }))));
            } catch { /* give up */ }
          }
          return updated;
        });
      };

      const handleEvent = (ev: any) => {
        if (!ev || typeof ev !== 'object') return;
        switch (ev.type) {
          case 'tool_call_start': {
            thinking.push({
              call_id: ev.call_id,
              tool: ev.tool,
              args: ev.args,
              status: 'running',
              preliminary_text: pendingPreliminaryText || undefined,
            });
            pendingPreliminaryText = '';
            break;
          }
          case 'tool_call_end': {
            const idx = thinking.findIndex(t => t.call_id === ev.call_id);
            if (idx >= 0) {
              thinking[idx] = {
                ...thinking[idx],
                status: ev.ok ? 'ok' : 'failed',
                receipt: ev.receipt,
                error: ev.error,
              };
            } else {
              thinking.push({
                call_id: ev.call_id,
                tool: ev.tool,
                status: ev.ok ? 'ok' : 'failed',
                receipt: ev.receipt,
                error: ev.error,
              });
            }
            if (ev.ok && ev.tool === 'images.generate' && ev.receipt?.image?.url) {
              assistantAttachments.push({ ...ev.receipt.image, dataUrl: '' });
            }
            // Cross-tab invalidation: signal other pages (Calendar, Notes, People) to refetch.
            // Only signal on successful WRITE tools — reads don't change state.
            if (ev.ok && typeof ev.tool === 'string') {
              const writeToolToDomains: Record<string, string[]> = {
                'calendar.create_event': ['calendar'],
                'calendar.update_event': ['calendar'],
                'calendar.delete_event': ['calendar'],
                'calendar.delete_events_batch': ['calendar'],
                'notes.create_note': ['notes'],
                'notes.edit_note': ['notes'],
                'memory.append_to_person': ['notes'],
                'memory.append_to_briefing': ['notes'],
                'goals.create_operating_plan': ['calendar', 'today', 'goals'],
                'goals.create_short_action_plan': ['calendar', 'today', 'goals'],
                'gmail.create_draft': ['gmail'],
              };
              const domains = writeToolToDomains[ev.tool];
              if (domains) {
                const ts = String(Date.now());
                for (const d of domains) {
                  try { localStorage.setItem(`balysai_invalidate_${d}`, ts); } catch {}
                }
              }
            }
            break;
          }
          case 'assistant_text': {
            if (ev.text) pendingPreliminaryText = (pendingPreliminaryText ? pendingPreliminaryText + '\n' : '') + ev.text;
            break;
          }
          case 'text': {
            if (typeof ev.text === 'string') assistantText += ev.text;
            break;
          }
          case 'error': {
            // surfaced as chat content via the next 'text' event from server
            console.warn('[balys-stream] error event', ev.message);
            break;
          }
          case 'done':
          case 'step_start':
            break;
        }
      };

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (isSse) {
          buffer += chunk;
          let nlIdx;
          while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, nlIdx);
            buffer = buffer.slice(nlIdx + 2);
            for (const line of rawEvent.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try { handleEvent(JSON.parse(payload)); } catch { /* skip malformed */ }
            }
          }
        } else {
          // Legacy plain-text streaming (older route shape)
          assistantText += chunk;
        }
        pushUiUpdate();
      }
      pushUiUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const at = UI[interfaceLang].ai;
  const destructiveIsFinal = destructiveDialog?.step === 2;
  const destructiveTitle = destructiveDialog?.kind === 'deleteThread' ? at.deleteChat : at.clearChatTitle;
  const destructiveBody = destructiveDialog?.kind === 'deleteThread'
    ? destructiveIsFinal
      ? at.deleteStep2(destructiveDialog.title)
      : at.deleteStep1(destructiveDialog.title)
    : destructiveIsFinal
      ? at.clearStep2(destructiveDialog?.title || 'this chat')
      : at.clearStep1(destructiveDialog?.title || 'this chat');

  const sidebarContent = (
    <Box sx={{ width: 220, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, color: 'text.disabled' }}>{at.chats}</Typography>
        <Tooltip title={at.newChat}><IconButton size="small" onClick={() => { newChat(); setSidebarOpen(false); }}><AddIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
        {threads.map(t => {
          const threadIsWhatsApp = isWhatsAppThread(t);
          const ThreadIcon = threadIsWhatsApp ? WhatsAppIcon : ChatIcon;
          return (
            <ListItemButton key={t.id} selected={t.id === activeThreadId} onClick={() => { setActiveThreadId(t.id); setSidebarOpen(false); }} sx={{ px: 1.5, py: 0.75 }}>
              <ThreadIcon sx={{ fontSize: 14, mr: 1, color: threadIsWhatsApp ? '#25D366' : 'text.disabled', flexShrink: 0 }} />
              <ListItemText primary={<Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>{t.title}</Typography>} />
              <IconButton size="small" onClick={e => requestDeleteThread(t.id, e)} sx={{ opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, p: 0.2 }}>
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Threads sidebar — desktop permanent, mobile drawer ── */}
      {/* Desktop */}
      <Box sx={{ width: 220, borderRight: '1px solid', borderColor: 'divider', display: { xs: 'none', md: 'flex' }, flexDirection: 'column' }}>
        {sidebarContent}
      </Box>
      {/* Mobile drawer — no keepMounted to avoid hydration mismatch */}
      <Drawer
        anchor="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: 240 } }}
      >
        {sidebarContent}
      </Drawer>

      {/* ── Chat area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Thread history button — mobile only (replaces second hamburger) */}
          <Tooltip title={at.chatHistory}>
            <IconButton size="small" onClick={() => setSidebarOpen(true)} sx={{ display: { xs: 'flex', md: 'none' }, mr: 0.5 }}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {activeIsWhatsAppThread
            ? <WhatsAppIcon sx={{ color: '#25D366', fontSize: 20 }} />
            : <SmartToyIcon color="secondary" fontSize="small" />}
          <Typography variant="subtitle1" fontWeight="bold">BalysAI</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={at.clearChat}>
            <span>
              <IconButton size="small" onClick={requestClearActiveThread} disabled={!activeThread?.messages.length}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, md: 3 }, py: 2 }}>
          {(!activeThread || activeThread.messages.length === 0) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
              <SmartToyIcon sx={{ fontSize: 64, opacity: 0.12 }} />
              <Typography variant="h6" color="text.secondary">{at.howCanIHelp}</Typography>
              <Typography variant="body2" color="text.disabled">{at.sendMessageHint}</Typography>
            </Box>
          )}

          <Stack spacing={2}>
            {activeThread?.messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const parsed = !isUser ? parseNoteEdits(msg.content) : null;
              const displayText = parsed ? parsed.clean : msg.content;
              const edits = parsed ? parsed.edits : [];

              return (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: isUser ? 'primary.main' : 'rgba(99,102,241,0.2)', flexShrink: 0 }}>
                    {isUser ? <PersonIcon sx={{ fontSize: 15 }} /> : <SmartToyIcon sx={{ fontSize: 15, color: '#818cf8' }} />}
                  </Avatar>
                  <Box sx={{ maxWidth: { xs: '85%', md: '75%' }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    {msg.attachments?.map((att, ai) => (
                      <Box key={ai}>
                        {att.type === 'image' && (att.dataUrl || att.url) && <Box component="img" src={att.dataUrl || att.url} alt={att.name} sx={{ maxWidth: 360, maxHeight: 360, borderRadius: 2 }} />}
                        {att.type === 'image' && !att.dataUrl && !att.url && <Chip icon={<ImageIcon />} label={att.name || 'Image'} size="small" variant="outlined" />}
                        {att.type === 'audio' && att.dataUrl && <Box component="audio" controls src={att.dataUrl} sx={{ display: 'block', maxWidth: 240 }} />}
                        {att.type === 'audio' && !att.dataUrl && <Chip icon={<AudioFileIcon />} label={att.name || 'Voice note'} size="small" variant="outlined" />}
                        {att.type === 'file' && <Chip icon={<AttachFileIcon />} label={att.name} size="small" variant="outlined" />}
                      </Box>
                    ))}
                    {isUser && msg.transcript && msg.transcript.trim() !== displayText.trim() && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontStyle: 'italic',
                          color: 'text.secondary',
                          maxWidth: 320,
                          display: 'block',
                          textAlign: 'right',
                          opacity: 0.8,
                        }}
                      >
                        “{msg.transcript}”
                      </Typography>
                    )}
                    {!isUser && msg.thinking && msg.thinking.length > 0 && (
                      <ThinkingTimeline steps={msg.thinking} done={Boolean(displayText)} lang={uiLang} />
                    )}
                    {isUser && msg.selectedAction && (
                      <Chip
                        icon={pendingActionIcon(msg.selectedAction.action)}
                        label={msg.selectedAction.label}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          color: 'primary.contrastText',
                          borderColor: 'rgba(255,255,255,0.35)',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiChip-icon': { color: 'inherit' },
                        }}
                      />
                    )}
                    {(displayText || msg.role === 'assistant') && (
                      <Paper elevation={0} sx={{
                        px: 2, py: 1.5,
                        bgcolor: isUser ? 'primary.main' : '#1e2433',
                        color: isUser ? 'white' : 'text.primary',
                        border: isUser ? 'none' : '1px solid',
                        borderColor: 'divider',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                        {isUser
                          ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                              {displayText}
                            </Typography>
                          )
                          : (
                            <>
                              <BalysMarkdown text={displayText || ''} />
                              {msg.role === 'assistant' && msg.content === '' && loading && <CircularProgress size={12} sx={{ ml: 1 }} />}
                            </>
                          )}
                      </Paper>
                    )}
                    {/* Note edit preview cards */}
                    {edits.map((block, ei) => (
                      <Box key={ei} sx={{ width: '100%', maxWidth: 520 }}>
                        <NoteEditCard block={block} onApply={applyNoteEdit} labels={at} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Stack>

          {loading && (!activeThread?.messages.length || activeThread.messages[activeThread.messages.length - 1]?.role !== 'assistant') && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 2 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'grey.300', flexShrink: 0 }}>
                <SmartToyIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              </Avatar>
              <Paper elevation={0} sx={{ px: 2, py: 1.5, bgcolor: 'grey.100', borderRadius: '18px 18px 18px 4px', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={13} thickness={5} />
                <Typography variant="body2" color="text.secondary">{at.thinking}</Typography>
              </Paper>
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          <div ref={bottomRef} />
        </Box>

        <Divider />

        {/* Pending action */}
        {pendingAction && (
          <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              size="small"
              icon={pendingActionIcon(pendingAction.action)}
              label={pendingAction.label}
              color="primary"
              onDelete={() => setPendingAction(null)}
              sx={{ fontWeight: 600 }}
            />
            {/* Location granted indicator */}
            {pendingAction.action === 'weather' && locationPermission === 'granted' && userLocation && (
              <Chip
                size="small"
                icon={<MyLocationIcon sx={{ fontSize: '13px !important' }} />}
                label={interfaceLang === 'pt' ? 'Localização detectada' : 'Location detected'}
                color="success"
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
            )}
          </Box>
        )}

        {/* Location denied nudge — shown when /weather is active but GPS was blocked */}
        {pendingAction?.action === 'weather' && locationPermission === 'denied' && (
          <Box sx={{
            mx: 2, mt: 1, px: 1.5, py: 1,
            border: '1px solid', borderColor: 'warning.dark',
            borderRadius: 1.5, bgcolor: 'rgba(234,179,8,0.07)',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <MyLocationIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
              {interfaceLang === 'pt'
                ? 'Localização bloqueada. Permita o acesso nas configurações do navegador ou digite o nome da cidade abaixo.'
                : 'Location blocked. Allow it in browser settings, or just type a city name below.'}
            </Typography>
          </Box>
        )}

        {/* Context items (RAG) */}
        {contextItems.length > 0 && (
          <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {contextItems.map(item => (
              <Chip
                key={item.id}
                size="small"
                icon={item.kind === 'note' ? <NoteIcon sx={{ fontSize: 14 }} /> : <EventIcon sx={{ fontSize: 14 }} />}
                label={item.label}
                color={item.kind === 'note' ? 'secondary' : 'info'}
                variant="outlined"
                onDelete={() => removeContext(item.id)}
              />
            ))}
          </Box>
        )}

        {activeIsWhatsAppThread && (
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(37, 211, 102, 0.06)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {at.whatsappReadOnly}
            </Typography>
          </Box>
        )}

        {/* Attachment previews */}
        {!activeIsWhatsAppThread && attachments.length > 0 && (
          <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {attachments.map((att, i) => (
              <Box key={i} sx={{ position: 'relative' }}>
                {att.type === 'image' && <Box component="img" src={att.dataUrl} alt={att.name} sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />}
                {att.type === 'audio' && <Chip icon={<AudioFileIcon />} label={att.name} size="small" variant="outlined" />}
                {att.type === 'file' && <Chip icon={<AttachFileIcon />} label={att.name} size="small" variant="outlined" />}
                <IconButton size="small" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 0.2 }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Input bar */}
        <Box ref={inputBoxRef} sx={{ px: { xs: 1, md: 2 }, py: 1.5, display: 'flex', gap: { xs: 0.5, md: 1 }, alignItems: 'flex-end' }}>
          <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFileChange(e, 'image')} />
          <input ref={fileInputRef} type="file" multiple hidden onChange={e => handleFileChange(e, 'file')} />
          <Tooltip title={activeIsWhatsAppThread ? at.whatsappMediaTooltip : at.imageTooltip}><IconButton size="small" onClick={() => imageInputRef.current?.click()} disabled={loading || activeIsWhatsAppThread}><ImageIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={activeIsWhatsAppThread ? at.whatsappFileTooltip : at.fileTooltip}><IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={loading || activeIsWhatsAppThread}><AttachFileIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={activeIsWhatsAppThread ? at.whatsappAudioTooltip : recording ? at.stop : at.recordAudio}>
            <IconButton size="small" onClick={recording ? stopRecording : startRecording} color={recording ? 'error' : 'default'} disabled={activeIsWhatsAppThread}>
              {recording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {recording && <Chip label={at.recording} color="error" size="small" />}
          <TextField fullWidth multiline maxRows={4}
            placeholder={activeIsWhatsAppThread ? at.whatsappPlaceholder : at.messageBalys}
            inputProps={{ 'aria-label': 'Message BalysAI' }}
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (cmdOpen) {
                // Only block Enter/Arrows when palette is actually selecting
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape') return;
                if (e.key === 'Enter') return;
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            size="small" disabled={loading || activeIsWhatsAppThread} suppressHydrationWarning />
          <span suppressHydrationWarning>
            <IconButton color="primary" onClick={sendMessage} disabled={activeIsWhatsAppThread || (!input.trim() && attachments.length === 0 && contextItems.length === 0 && !pendingAction) || loading} sx={{ mb: 0.5 }} suppressHydrationWarning>
              {loading ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </span>
        </Box>

        {/* / Command palette */}
        {cmdOpen && (
          <CommandPalette
            anchorEl={inputBoxRef.current}
            query={cmdQuery}
            uiLang={interfaceLang}
            onSelect={handleContextSelect}
            onClose={() => setCmdOpen(false)}
          />
        )}
      </Box>

      <Dialog open={Boolean(destructiveDialog)} onClose={() => setDestructiveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{destructiveTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {destructiveBody}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDestructiveDialog(null)} color="inherit">{at.cancel}</Button>
          <Button onClick={confirmDestructiveAction} color="error" variant={destructiveIsFinal ? 'contained' : 'outlined'}>
            {destructiveIsFinal ? at.deletePermanently : at.continue}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

type Lang = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'zh';

const TOOL_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    'calendar.list_events': 'Searching events',
    'calendar.create_event': 'Creating event',
    'calendar.update_event': 'Updating event',
    'calendar.delete_event': 'Removing event',
    'calendar.delete_events_batch': 'Removing events in bulk',
    'gmail.search_messages': 'Searching emails',
    'gmail.read_message': 'Reading email',
    'gmail.create_draft': 'Drafting email',
    'notes.create_note': 'Creating note',
    'notes.list_notes': 'Searching notes',
    'notes.edit_note': 'Editing note',
    'connectors.list': 'Listing connections',
    'connectors.search_docs': 'Discovering files',
    'connectors.read_drive_file': 'Reading Drive file',
    'connectors.read_doc': 'Reading document',
    'connectors.find_and_read_doc': 'Finding document',
    'connectors.read_sheet': 'Reading spreadsheet',
    'connectors.create_doc': 'Creating document',
    'connectors.docs_agent': 'Editing document',
    'connectors.sheets_agent': 'Analyzing spreadsheet',
    'council.convene': 'Convening the council',
    'council.round_1': 'Council round 1',
    'council.round_2': 'Council round 2',
    'council.alignment': 'CEO alignment check',
    'council.cross_examination': 'Council cross-examination',
    'council.ceo': 'CEO moderation',
    'council.voice': 'Advisor voice',
    'people.search': 'Searching contact',
  },
  pt: {
    'calendar.list_events': 'Buscando eventos',
    'calendar.create_event': 'Criando evento',
    'calendar.update_event': 'Atualizando evento',
    'calendar.delete_event': 'Removendo evento',
    'calendar.delete_events_batch': 'Removendo eventos em lote',
    'gmail.search_messages': 'Buscando emails',
    'gmail.read_message': 'Lendo email',
    'gmail.create_draft': 'Rascunhando email',
    'notes.create_note': 'Criando nota',
    'notes.list_notes': 'Buscando notas',
    'notes.edit_note': 'Editando nota',
    'connectors.list': 'Listando conexões',
    'connectors.search_docs': 'Procurando arquivos',
    'connectors.read_drive_file': 'Lendo arquivo do Drive',
    'connectors.read_doc': 'Lendo documento',
    'connectors.find_and_read_doc': 'Buscando documento',
    'connectors.read_sheet': 'Lendo planilha',
    'connectors.create_doc': 'Criando documento',
    'connectors.docs_agent': 'Editando documento',
    'connectors.sheets_agent': 'Analisando planilha',
    'council.convene': 'Convocando o conselho',
    'council.round_1': 'Rodada 1 do conselho',
    'council.round_2': 'Rodada 2 do conselho',
    'council.alignment': 'Checagem do CEO',
    'council.cross_examination': 'Questionamento entre conselheiros',
    'council.ceo': 'Moderação do CEO',
    'council.voice': 'Voz do conselheiro',
    'people.search': 'Buscando contato',
  },
  es: {
    'calendar.list_events': 'Buscando eventos',
    'calendar.create_event': 'Creando evento',
    'calendar.update_event': 'Actualizando evento',
    'calendar.delete_event': 'Eliminando evento',
    'calendar.delete_events_batch': 'Eliminando eventos en lote',
    'gmail.search_messages': 'Buscando correos',
    'gmail.create_draft': 'Redactando correo',
    'notes.create_note': 'Creando nota',
    'notes.list_notes': 'Buscando notas',
    'notes.edit_note': 'Editando nota',
    'connectors.list': 'Listando conexiones',
    'council.convene': 'Convocando el consejo',
    'people.search': 'Buscando contacto',
  },
  fr: {
    'calendar.list_events': 'Recherche d\'événements',
    'calendar.create_event': 'Création d\'événement',
    'calendar.update_event': 'Mise à jour de l\'événement',
    'calendar.delete_event': 'Suppression de l\'événement',
    'calendar.delete_events_batch': 'Suppression d\'événements en lot',
    'gmail.search_messages': 'Recherche d\'e-mails',
    'gmail.create_draft': 'Rédaction d\'e-mail',
    'notes.create_note': 'Création de note',
    'notes.list_notes': 'Recherche de notes',
    'notes.edit_note': 'Modification de note',
    'connectors.list': 'Liste des connexions',
    'council.convene': 'Réunion du conseil',
    'people.search': 'Recherche de contact',
  },
  de: {
    'calendar.list_events': 'Termine suchen',
    'calendar.create_event': 'Termin erstellen',
    'calendar.update_event': 'Termin aktualisieren',
    'calendar.delete_event': 'Termin löschen',
    'calendar.delete_events_batch': 'Termine im Batch löschen',
    'gmail.search_messages': 'E-Mails suchen',
    'gmail.create_draft': 'E-Mail entwerfen',
    'notes.create_note': 'Notiz erstellen',
    'notes.list_notes': 'Notizen suchen',
    'notes.edit_note': 'Notiz bearbeiten',
    'connectors.list': 'Verbindungen auflisten',
    'council.convene': 'Rat einberufen',
    'people.search': 'Kontakt suchen',
  },
  it: {
    'calendar.list_events': 'Ricerca eventi',
    'calendar.create_event': 'Creazione evento',
    'calendar.update_event': 'Aggiornamento evento',
    'calendar.delete_event': 'Eliminazione evento',
    'calendar.delete_events_batch': 'Eliminazione eventi in blocco',
    'gmail.search_messages': 'Ricerca email',
    'gmail.create_draft': 'Bozza email',
    'notes.create_note': 'Creazione nota',
    'notes.list_notes': 'Ricerca note',
    'notes.edit_note': 'Modifica nota',
    'connectors.list': 'Elenco connessioni',
    'council.convene': 'Convocazione del consiglio',
    'people.search': 'Ricerca contatto',
  },
  ja: {
    'calendar.list_events': 'イベントを検索中',
    'calendar.create_event': 'イベントを作成中',
    'calendar.update_event': 'イベントを更新中',
    'calendar.delete_event': 'イベントを削除中',
    'calendar.delete_events_batch': 'イベントを一括削除中',
    'gmail.search_messages': 'メールを検索中',
    'gmail.create_draft': 'メール下書き中',
    'notes.create_note': 'メモを作成中',
    'notes.list_notes': 'メモを検索中',
    'notes.edit_note': 'メモを編集中',
    'connectors.list': '接続を一覧表示中',
    'council.convene': '評議会を招集中',
    'people.search': '連絡先を検索中',
  },
  zh: {
    'calendar.list_events': '搜索事件中',
    'calendar.create_event': '创建事件中',
    'calendar.update_event': '更新事件中',
    'calendar.delete_event': '删除事件中',
    'calendar.delete_events_batch': '批量删除事件中',
    'gmail.search_messages': '搜索邮件中',
    'gmail.create_draft': '起草邮件中',
    'notes.create_note': '创建笔记中',
    'notes.list_notes': '搜索笔记中',
    'notes.edit_note': '编辑笔记中',
    'connectors.list': '列出连接中',
    'council.convene': '召集委员会中',
    'people.search': '搜索联系人中',
  },
};

interface I18nStrings {
  steps: (n: number) => string;
  stepsWithFailure: (n: number) => string;
  found: (tool: string, n: number) => string;
  deletedSummary: (deleted: number, failed: number) => string;
  created: string;
  updated: string;
  deleted: string;
  consulted: (n: number) => string;
  draftSaved: string;
}

const I18N: Record<Lang, I18nStrings> = {
  en: {
    steps: n => `${n} step${n === 1 ? '' : 's'}`,
    stepsWithFailure: n => `${n} step${n === 1 ? '' : 's'} (with failure)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'event' : 'events')
        : tool === 'people.search' ? (n === 1 ? 'contact' : 'contacts')
        : tool === 'notes.list_notes' ? (n === 1 ? 'note' : 'notes')
        : tool === 'gmail.search_messages' ? (n === 1 ? 'message' : 'messages')
        : tool === 'connectors.search_docs' ? (n === 1 ? 'file' : 'files')
        : 'results';
      return `${n} ${noun} found`;
    },
    deletedSummary: (deleted, failed) => `${deleted} deleted${failed ? `, ${failed} failed` : ''}`,
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    consulted: n => `${n} members consulted`,
    draftSaved: 'draft saved',
  },
  pt: {
    steps: n => `${n} passo${n === 1 ? '' : 's'}`,
    stepsWithFailure: n => `${n} passo${n === 1 ? '' : 's'} (com falha)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'evento encontrado' : 'eventos encontrados')
        : tool === 'people.search' ? (n === 1 ? 'contato encontrado' : 'contatos encontrados')
        : tool === 'notes.list_notes' ? (n === 1 ? 'nota encontrada' : 'notas encontradas')
        : tool === 'gmail.search_messages' ? (n === 1 ? 'mensagem encontrada' : 'mensagens encontradas')
        : tool === 'connectors.search_docs' ? (n === 1 ? 'arquivo encontrado' : 'arquivos encontrados')
        : 'resultados';
      return `${n} ${noun}`;
    },
    deletedSummary: (deleted, failed) => `${deleted} removido${deleted === 1 ? '' : 's'}${failed ? `, ${failed} falharam` : ''}`,
    created: 'criado',
    updated: 'atualizado',
    deleted: 'removido',
    consulted: n => `${n} membros consultados`,
    draftSaved: 'rascunho salvo',
  },
  es: {
    steps: n => `${n} paso${n === 1 ? '' : 's'}`,
    stepsWithFailure: n => `${n} paso${n === 1 ? '' : 's'} (con fallo)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'evento' : 'eventos')
        : tool === 'people.search' ? (n === 1 ? 'contacto' : 'contactos')
        : tool === 'notes.list_notes' ? (n === 1 ? 'nota' : 'notas')
        : tool === 'gmail.search_messages' ? (n === 1 ? 'mensaje' : 'mensajes')
        : 'resultados';
      return `${n} ${noun} encontrado${n === 1 ? '' : 's'}`;
    },
    deletedSummary: (deleted, failed) => `${deleted} eliminado${deleted === 1 ? '' : 's'}${failed ? `, ${failed} fallaron` : ''}`,
    created: 'creado',
    updated: 'actualizado',
    deleted: 'eliminado',
    consulted: n => `${n} miembros consultados`,
    draftSaved: 'borrador guardado',
  },
  fr: {
    steps: n => `${n} étape${n === 1 ? '' : 's'}`,
    stepsWithFailure: n => `${n} étape${n === 1 ? '' : 's'} (avec échec)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'événement' : 'événements')
        : tool === 'people.search' ? (n === 1 ? 'contact' : 'contacts')
        : tool === 'notes.list_notes' ? (n === 1 ? 'note' : 'notes')
        : tool === 'gmail.search_messages' ? 'messages'
        : 'résultats';
      return `${n} ${noun} trouvé${n === 1 ? '' : 's'}`;
    },
    deletedSummary: (deleted, failed) => `${deleted} supprimé${deleted === 1 ? '' : 's'}${failed ? `, ${failed} échoué${failed === 1 ? '' : 's'}` : ''}`,
    created: 'créé',
    updated: 'mis à jour',
    deleted: 'supprimé',
    consulted: n => `${n} membres consultés`,
    draftSaved: 'brouillon enregistré',
  },
  de: {
    steps: n => `${n} Schritt${n === 1 ? '' : 'e'}`,
    stepsWithFailure: n => `${n} Schritt${n === 1 ? '' : 'e'} (mit Fehler)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'Termin' : 'Termine')
        : tool === 'people.search' ? (n === 1 ? 'Kontakt' : 'Kontakte')
        : tool === 'notes.list_notes' ? (n === 1 ? 'Notiz' : 'Notizen')
        : tool === 'gmail.search_messages' ? (n === 1 ? 'Nachricht' : 'Nachrichten')
        : 'Ergebnisse';
      return `${n} ${noun} gefunden`;
    },
    deletedSummary: (deleted, failed) => `${deleted} gelöscht${failed ? `, ${failed} fehlgeschlagen` : ''}`,
    created: 'erstellt',
    updated: 'aktualisiert',
    deleted: 'gelöscht',
    consulted: n => `${n} Mitglieder konsultiert`,
    draftSaved: 'Entwurf gespeichert',
  },
  it: {
    steps: n => `${n} passaggio${n === 1 ? '' : 'i'}`,
    stepsWithFailure: n => `${n} passaggio${n === 1 ? '' : 'i'} (con errore)`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? (n === 1 ? 'evento trovato' : 'eventi trovati')
        : tool === 'people.search' ? (n === 1 ? 'contatto trovato' : 'contatti trovati')
        : tool === 'notes.list_notes' ? (n === 1 ? 'nota trovata' : 'note trovate')
        : tool === 'gmail.search_messages' ? (n === 1 ? 'messaggio trovato' : 'messaggi trovati')
        : 'risultati';
      return `${n} ${noun}`;
    },
    deletedSummary: (deleted, failed) => `${deleted} eliminato${deleted === 1 ? '' : 'i'}${failed ? `, ${failed} fallito${failed === 1 ? '' : 'i'}` : ''}`,
    created: 'creato',
    updated: 'aggiornato',
    deleted: 'eliminato',
    consulted: n => `${n} membri consultati`,
    draftSaved: 'bozza salvata',
  },
  ja: {
    steps: n => `${n}ステップ`,
    stepsWithFailure: n => `${n}ステップ（失敗あり）`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? 'イベント'
        : tool === 'people.search' ? '連絡先'
        : tool === 'notes.list_notes' ? 'メモ'
        : tool === 'gmail.search_messages' ? 'メッセージ'
        : '結果';
      return `${n}件の${noun}が見つかりました`;
    },
    deletedSummary: (deleted, failed) => `${deleted}件削除${failed ? `、${failed}件失敗` : ''}`,
    created: '作成済み',
    updated: '更新済み',
    deleted: '削除済み',
    consulted: n => `${n}名のメンバーが相談しました`,
    draftSaved: '下書き保存',
  },
  zh: {
    steps: n => `${n} 个步骤`,
    stepsWithFailure: n => `${n} 个步骤（含失败）`,
    found: (tool, n) => {
      const noun = tool === 'calendar.list_events' ? '个事件'
        : tool === 'people.search' ? '个联系人'
        : tool === 'notes.list_notes' ? '条笔记'
        : tool === 'gmail.search_messages' ? '条消息'
        : '个结果';
      return `找到 ${n} ${noun}`;
    },
    deletedSummary: (deleted, failed) => `已删除 ${deleted}${failed ? `, ${failed} 失败` : ''}`,
    created: '已创建',
    updated: '已更新',
    deleted: '已删除',
    consulted: n => `已咨询 ${n} 位成员`,
    draftSaved: '草稿已保存',
  },
};

function resolveLang(input: string | null | undefined): Lang {
  const v = (input || 'en').toLowerCase().split('-')[0] as Lang;
  return (I18N[v] ? v : 'en');
}

function summarizeReceipt(tool: string, receipt: any, lang: Lang): string {
  if (!receipt || typeof receipt !== 'object') return '';
  const t = I18N[lang];
  if (receipt.status === 'council_phase' && typeof receipt.summary === 'string') {
    return receipt.summary;
  }
  if (receipt.status === 'council_voice' && typeof receipt.summary === 'string') {
    const speaker = typeof receipt.speaker === 'string' ? `${receipt.speaker}: ` : '';
    return `${speaker}${receipt.summary}`;
  }
  if (typeof receipt.count === 'number') {
    return t.found(tool, receipt.count);
  }
  if (typeof receipt.deleted_count === 'number') {
    return t.deletedSummary(receipt.deleted_count, receipt.failed_count || 0);
  }
  if (receipt.status === 'created') return t.created;
  if (receipt.status === 'updated') return t.updated;
  if (receipt.status === 'deleted') return t.deleted;
  if (receipt.status === 'consulted') return t.consulted(receipt.members_consulted || 0);
  if (receipt.status === 'draft_created') return t.draftSaved;
  return '';
}

// Colour per advisor role — matches the council member roster
const ADVISOR_COLORS: Record<string, string> = {
  advogado:    '#f59e0b',
  revops:      '#3b82f6',
  empreendedor:'#10b981',
  contador:    '#8b5cf6',
  politico:    '#ef4444',
  psicologo:   '#ec4899',
  medico:      '#06b6d4',
  espiritual:  '#a78bfa',
  amoroso:     '#f472b6',
  mecanico:    '#78716c',
  economista:  '#84cc16',
};

function CouncilVoiceCard({ receipt }: { receipt: any }) {
  const [open, setOpen] = React.useState(false);
  const color = ADVISOR_COLORS[receipt.role] || '#94a3b8';
  const roundLabel = receipt.phase === 'refinement' ? 'R2'
    : receipt.phase === 'cross_examination' ? 'R3'
    : 'R1';

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          cursor: 'pointer', py: '2px',
          '&:hover': { opacity: 0.85 },
        }}
      >
        {/* colour dot */}
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color, fontWeight: 600, lineHeight: 1 }}>
          {receipt.speaker}
        </Typography>
        <Chip label={roundLabel} size="small" sx={{ height: 14, fontSize: 9, bgcolor: `${color}22`, color, px: 0 }} />
        <Box component="span" sx={{ fontSize: 10, color: 'text.disabled', ml: 'auto' }}>
          {open ? '▾' : '▸'}
        </Box>
      </Box>

      {open && (
        <Box sx={{
          mt: 0.5, ml: 1.5,
          p: 1.25,
          bgcolor: 'rgba(15,23,42,0.7)',
          border: `1px solid ${color}33`,
          borderLeft: `3px solid ${color}`,
          borderRadius: '0 6px 6px 0',
        }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {receipt.advice}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

interface ThinkingTimelineProps { steps: ThinkingStep[]; done: boolean; lang: Lang }
function ThinkingTimeline({ steps, done, lang }: ThinkingTimelineProps) {
  const [expanded, setExpanded] = React.useState(!done);
  React.useEffect(() => { if (!done) setExpanded(true); }, [done]);

  if (steps.length === 0) return null;
  const labels = TOOL_LABELS[lang] || TOOL_LABELS.en;
  const t = I18N[lang];
  const running = steps.some(s => s.status === 'running');
  const failed = steps.some(s => s.status === 'failed');
  const lastLabel = labels[steps[steps.length - 1].tool] || steps[steps.length - 1].tool;

  const summary = running
    ? `${lastLabel}…`
    : failed
      ? t.stepsWithFailure(steps.length)
      : t.steps(steps.length);

  return (
    <Box sx={{ maxWidth: 480, alignSelf: 'flex-start' }}>
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 1,
          cursor: 'pointer',
          color: 'text.secondary',
          fontSize: 12,
          '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        {running
          ? <CircularProgress size={11} sx={{ color: 'text.secondary' }} />
          : failed
            ? <Box component="span" sx={{ fontSize: 11 }}>✗</Box>
            : <Box component="span" sx={{ fontSize: 11 }}>✓</Box>}
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>{summary}</Typography>
        <Box component="span" sx={{ fontSize: 10, opacity: 0.6 }}>{expanded ? '▾' : '▸'}</Box>
      </Box>
      {expanded && (
        <Box sx={{ mt: 0.5, ml: 1, borderLeft: '2px solid', borderColor: 'divider', pl: 1.5, py: 0.25 }}>
          {steps.map((step, i) => {
            const label = labels[step.tool] || step.tool;
            const summary = step.status === 'ok' ? summarizeReceipt(step.tool, step.receipt, lang) : '';

            // Council voice — rich expandable advisor card
            if (step.tool === 'council.voice' && step.receipt?.advice) {
              return (
                <CouncilVoiceCard key={step.call_id || i} receipt={step.receipt} />
              );
            }

            return (
              <Box key={step.call_id || i} sx={{ mb: 0.5, fontSize: 12 }}>
                {step.preliminary_text && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic', mb: 0.25 }}>
                    {step.preliminary_text}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, color: 'text.secondary' }}>
                  {step.status === 'running'
                    ? <CircularProgress size={9} sx={{ color: 'text.disabled' }} />
                    : step.status === 'ok'
                      ? <Box component="span" sx={{ fontSize: 10, color: 'success.main' }}>●</Box>
                      : <Box component="span" sx={{ fontSize: 10, color: 'error.main' }}>●</Box>}
                  <Typography variant="caption" component="span">{label}</Typography>
                  {summary && (
                    <Typography variant="caption" component="span" sx={{ color: 'text.disabled' }}>— {summary}</Typography>
                  )}
                  {step.status === 'failed' && step.error && (
                    <Typography variant="caption" component="span" sx={{ color: 'error.main' }}>— {step.error.slice(0, 120)}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
