'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, TextField, IconButton, Typography, Paper, Stack,
  Chip, Divider, CircularProgress, Alert, Tooltip, Avatar,
  List, ListItemButton, ListItemText, ListSubheader, Skeleton,
  MenuItem, Menu
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NoteIcon from '@mui/icons-material/Note';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CommandPalette, { ContextItem } from '@/components/ai/CommandPalette';

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
function NoteEditCard({ block, onApply }: { block: NoteEditBlock; onApply: (b: NoteEditBlock) => Promise<void> }) {
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
          NOTE EDIT PREVIEW — {block.noteTitle}
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
            {applied ? 'Applied' : applying ? 'Applying…' : 'Apply to note'}
          </Typography>
        </Box>
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

const STORAGE_KEY_MODEL    = 'balysai_model';
const STORAGE_KEY_PROVIDER = 'balysai_provider';
const STORAGE_KEY_THREADS  = 'balysai_threads';

interface ModelEntry { id: string; label: string; provider: string; desc: string; }
interface Attachment { type: 'image' | 'file' | 'audio'; name: string; dataUrl: string; mimeType: string; }
interface Message { role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; }
interface Thread { id: string; title: string; messages: Message[]; model: string; provider: string; createdAt: number; }

function newThread(model: string, provider: string): Thread {
  return { id: Date.now().toString(), title: 'New chat', messages: [], model, provider, createdAt: Date.now() };
}

export default function AIPage() {
  const [model, setModel]       = useState('gpt-4o');
  const [provider, setProvider] = useState('openai');
  const [openaiModels, setOpenaiModels] = useState<ModelEntry[]>([]);
  const [geminiModels, setGeminiModels] = useState<ModelEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelAnchor, setModelAnchor] = useState<null | HTMLElement>(null);

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
  const inputBoxRef = useRef<HTMLDivElement>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  // Load from localStorage
  useEffect(() => {
    const m = localStorage.getItem(STORAGE_KEY_MODEL) || 'gpt-4o';
    const p = localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openai';
    setModel(m); setProvider(p);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_THREADS) || '[]') as Thread[];
      if (saved.length) { setThreads(saved); setActiveThreadId(saved[0].id); }
      else { const t = newThread(m, p); setThreads([t]); setActiveThreadId(t.id); }
    } catch { const t = newThread(m, p); setThreads([t]); setActiveThreadId(t.id); }
  }, []);

  // Fetch models — validate stored model against available list
  useEffect(() => {
    fetch('/api/ai/models').then(r => r.json()).then(data => {
      const openai: ModelEntry[] = data.openai || [];
      const gemini: ModelEntry[] = data.gemini || [];
      setOpenaiModels(openai); setGeminiModels(gemini);
      // If current stored model is unavailable, switch to first available
      const all = [...openai, ...gemini];
      if (all.length > 0) {
        setModel(prev => {
          const still = all.find(m => m.id === prev);
          if (still) return prev;
          const first = all[0];
          setProvider(first.provider);
          localStorage.setItem(STORAGE_KEY_MODEL, first.id);
          localStorage.setItem(STORAGE_KEY_PROVIDER, first.provider);
          return first.id;
        });
      }
    }).finally(() => setModelsLoading(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeThread?.messages, loading]);

  const persistThreads = (t: Thread[]) => {
    // Strip attachment dataUrls (base64) before persisting — they blow the localStorage quota
    const stripped = t.map(thread => ({
      ...thread,
      messages: thread.messages.map(msg =>
        msg.attachments?.length
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

  const selectModel = (id: string, prov: string) => {
    setModel(id); setProvider(prov);
    localStorage.setItem(STORAGE_KEY_MODEL, id);
    localStorage.setItem(STORAGE_KEY_PROVIDER, prov);
    setModelAnchor(null);
  };

  const newChat = () => {
    const t = newThread(model, provider);
    saveThreads([t, ...threads]);
    setActiveThreadId(t.id);
    setError(null);
  };

  const deleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = threads.filter(t => t.id !== id);
    if (updated.length === 0) { const t = newThread(model, provider); saveThreads([t]); setActiveThreadId(t.id); }
    else { saveThreads(updated); if (activeThreadId === id) setActiveThreadId(updated[0].id); }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setAttachments(prev => [...prev, { type, name: file.name, dataUrl: reader.result as string, mimeType: file.type }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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
    setContextItems(prev => prev.find(c => c.id === item.id) ? prev : [...prev, item]);
    setCmdOpen(false);
  };

  const removeContext = (id: string) => setContextItems(prev => prev.filter(c => c.id !== id));

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0 && contextItems.length === 0) || loading || !activeThread) return;

    let messageContent = input.trim();

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

    const userMsg: Message = { role: 'user', content: messageContent, attachments };
    const newMessages = [...activeThread.messages, userMsg];
    const title = activeThread.title === 'New chat' && input.trim()
      ? input.trim().slice(0, 40)
      : activeThread.title;

    const updatedThread: Thread = { ...activeThread, messages: newMessages, title, model, provider };
    saveThreads(threads.map(t => t.id === activeThreadId ? updatedThread : t));

    setInput(''); setAttachments([]); setContextItems([]); setCmdOpen(false); setLoading(true); setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, model, provider, language: localStorage.getItem('balysai_language') || 'en', systemAddendum: noteEditSystemPrompt }),
      });

      if (!res.ok) {
        const text = await res.text();
        try { const e = JSON.parse(text); throw new Error(e.error?.message || e.error || text); }
        catch (pe) { if (pe instanceof SyntaxError) throw new Error(text || 'Request failed'); else throw pe; }
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const withAssistant = [...newMessages, { role: 'assistant' as const, content: '' }];
      saveThreads(threads.map(t => t.id === activeThreadId ? { ...updatedThread, messages: withAssistant } : t));

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setThreads(prev => {
          const updated = prev.map(t => {
            if (t.id !== activeThreadId) return t;
            const msgs = [...newMessages, { role: 'assistant' as const, content: assistantText }];
            return { ...t, messages: msgs };
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
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const allModels = [...openaiModels, ...geminiModels];
  const currentModel = allModels.find(m => m.id === model);
  const providerColor = provider === 'gemini' ? 'success' : 'primary';

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Threads sidebar ── */}
      <Box sx={{ width: 220, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, color: 'text.disabled' }}>Chats</Typography>
          <Tooltip title="New chat"><IconButton size="small" onClick={newChat}><AddIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
        <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
          {threads.map(t => (
            <ListItemButton key={t.id} selected={t.id === activeThreadId} onClick={() => setActiveThreadId(t.id)} sx={{ px: 1.5, py: 0.75 }}>
              <ChatIcon sx={{ fontSize: 14, mr: 1, color: 'text.disabled', flexShrink: 0 }} />
              <ListItemText primary={<Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>{t.title}</Typography>} />
              <IconButton size="small" onClick={e => deleteThread(t.id, e)} sx={{ opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, p: 0.2 }}>
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* ── Chat area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header with model selector */}
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color={providerColor} fontSize="small" />
          <Typography variant="subtitle1" fontWeight="bold">BalysAI</Typography>
          <Box sx={{ flex: 1 }} />

          {/* Model selector dropdown */}
          <Chip
            label={modelsLoading ? '...' : (currentModel?.label || model)}
            size="small"
            color={providerColor}
            variant="outlined"
            onClick={e => setModelAnchor(e.currentTarget)}
            onDelete={e => setModelAnchor(e.currentTarget as HTMLElement)}
            deleteIcon={<ExpandMoreIcon />}
            sx={{ cursor: 'pointer', maxWidth: 200 }}
          />
          <Menu
            anchorEl={modelAnchor}
            open={Boolean(modelAnchor)}
            onClose={() => setModelAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 400, width: 280, bgcolor: '#1e2433', border: '1px solid', borderColor: 'divider' } } }}
          >
            {modelsLoading ? (
              <Box sx={{ p: 2 }}><Skeleton width="80%" /><Skeleton width="60%" /></Box>
            ) : (
              [
                openaiModels.length > 0 && (
                  <ListSubheader key="openai-header" sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 10, letterSpacing: '0.1em', color: 'text.disabled' }}>
                    OPENAI
                  </ListSubheader>
                ),
                ...openaiModels.map(entry => (
                  <MenuItem key={entry.id} selected={model === entry.id && provider === 'openai'} onClick={() => selectModel(entry.id, 'openai')} dense sx={{ gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{entry.label}</Typography>}
                      secondary={<Typography variant="caption" sx={{ fontSize: 11, color: 'text.disabled' }}>{entry.desc}</Typography>}
                    />
                  </MenuItem>
                )),
                geminiModels.length > 0 && (
                  <ListSubheader key="gemini-header" sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 10, letterSpacing: '0.1em', color: 'text.disabled' }}>
                    GEMINI
                  </ListSubheader>
                ),
                ...geminiModels.map(entry => (
                  <MenuItem key={entry.id} selected={model === entry.id && provider === 'gemini'} onClick={() => selectModel(entry.id, 'gemini')} dense sx={{ gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{entry.label}</Typography>}
                      secondary={<Typography variant="caption" sx={{ fontSize: 11, color: 'text.disabled' }}>{entry.desc}</Typography>}
                    />
                  </MenuItem>
                )),
              ]
            )}
          </Menu>

          <Tooltip title="Clear chat">
            <span>
              <IconButton size="small" onClick={() => {
                if (!activeThread) return;
                saveThreads(threads.map(t => t.id === activeThreadId ? { ...t, messages: [], title: 'New chat' } : t));
              }} disabled={!activeThread?.messages.length}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
          {(!activeThread || activeThread.messages.length === 0) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
              <SmartToyIcon sx={{ fontSize: 64, opacity: 0.12 }} />
              <Typography variant="h6" color="text.secondary">How can I help you today?</Typography>
              <Typography variant="body2" color="text.disabled">Send a message, attach files, images, or record audio</Typography>
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
                  <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    {msg.attachments?.filter(att => att.dataUrl).map((att, ai) => (
                      <Box key={ai}>
                        {att.type === 'image' && <Box component="img" src={att.dataUrl} alt={att.name} sx={{ maxWidth: 240, maxHeight: 180, borderRadius: 2 }} />}
                        {att.type === 'audio' && <Box component="audio" controls src={att.dataUrl} sx={{ display: 'block', maxWidth: 240 }} />}
                        {att.type === 'file' && <Chip icon={<AttachFileIcon />} label={att.name} size="small" variant="outlined" />}
                      </Box>
                    ))}
                    {(displayText || msg.role === 'assistant') && (
                      <Paper elevation={0} sx={{
                        px: 2, py: 1.5,
                        bgcolor: isUser ? 'primary.main' : '#1e2433',
                        color: isUser ? 'white' : 'text.primary',
                        border: isUser ? 'none' : '1px solid',
                        borderColor: 'divider',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {displayText}
                          {msg.role === 'assistant' && msg.content === '' && loading && <CircularProgress size={12} sx={{ ml: 1 }} />}
                        </Typography>
                      </Paper>
                    )}
                    {/* Note edit preview cards */}
                    {edits.map((block, ei) => (
                      <Box key={ei} sx={{ width: '100%', maxWidth: 520 }}>
                        <NoteEditCard block={block} onApply={applyNoteEdit} />
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
                <Typography variant="body2" color="text.secondary">Thinking...</Typography>
              </Paper>
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          <div ref={bottomRef} />
        </Box>

        <Divider />

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

        {/* Attachment previews */}
        {attachments.length > 0 && (
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
        <Box ref={inputBoxRef} sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFileChange(e, 'image')} />
          <input ref={fileInputRef} type="file" multiple hidden onChange={e => handleFileChange(e, 'file')} />
          <Tooltip title="Image"><IconButton size="small" onClick={() => imageInputRef.current?.click()} disabled={loading}><ImageIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="File"><IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={loading}><AttachFileIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={recording ? 'Stop' : 'Record audio'}>
            <IconButton size="small" onClick={recording ? stopRecording : startRecording} color={recording ? 'error' : 'default'}>
              {recording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {recording && <Chip label="Recording..." color="error" size="small" />}
          <TextField fullWidth multiline maxRows={4} placeholder='Message BalysAI... (type / to add notes or events as context)' value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (cmdOpen) return; // let CommandPalette handle arrows/enter/esc
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            size="small" disabled={loading} />
          <span>
            <IconButton color="primary" onClick={sendMessage} disabled={(!input.trim() && attachments.length === 0 && contextItems.length === 0) || loading} sx={{ mb: 0.5 }}>
              {loading ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </span>
        </Box>

        {/* / Command palette */}
        {cmdOpen && (
          <CommandPalette
            anchorEl={inputBoxRef.current}
            query={cmdQuery}
            onSelect={handleContextSelect}
            onClose={() => setCmdOpen(false)}
          />
        )}
      </Box>
    </Box>
  );
}
