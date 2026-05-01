'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import {
  Box, TextField, Typography, Chip, Stack, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, Divider, CircularProgress,
  Menu, MenuItem, Alert, Select
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import EventIcon from '@mui/icons-material/Event';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import ImageIcon from '@mui/icons-material/Image';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import MentionList from './MentionList';
import DocumentMentionList, { DocItem } from './DocumentMentionList';
import { PluginKey } from '@tiptap/pm/state';

interface Person {
  id: string;
  name: string;
  email?: string;
}

interface NoteData {
  id?: string;
  title: string;
  content: object | null;
  content_text?: string;
  note_date: string | null;
  event_id: string | null;
  event_title: string | null;
  event_start: string | null;
  note_type: 'event' | 'daily_briefing' | 'manual' | 'person';
  note_mentions?: { person_id: string; people: { id: string; name: string } }[];
}

interface NoteEditorProps {
  note: NoteData | null;
  onSave: (data: Partial<NoteData> & { mention_ids: string[] }) => Promise<void>;
  onRename?: (newName: string) => Promise<void>;
  onDelete?: () => void;
  saving?: boolean;
}

// Extend Image node to support alignment attribute
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: { default: null, renderHTML: attrs => attrs.align ? { 'data-align': attrs.align } : {} },
      width: { default: null, renderHTML: attrs => attrs.width ? { width: attrs.width } : {} },
    };
  },
});

const DocumentMention = Mention.extend({
  name: 'documentMention',
});

export default function NoteEditor({ note, onSave, onRename, onDelete, saving }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [mentionedPeople, setMentionedPeople] = useState<Person[]>([]);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const renameTitleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Transcription model selector — populated dynamically from /api/ai/models
  type TranscribeOption = { provider: 'openai' | 'gemini'; model: string; label: string };
  const STORAGE_KEY_TRANSCRIBE = 'briefing_transcribe_model';
  const [transcribeOptions, setTranscribeOptions] = useState<TranscribeOption[]>([]);
  const [transcribeModelKey, setTranscribeModelKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY_TRANSCRIBE) || '';
  });

  useEffect(() => {
    fetch('/api/ai/models')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { openai: { id: string; label: string }[]; gemini: { id: string; label: string }[] }) => {
        const opts: TranscribeOption[] = [
          ...data.gemini.map(m => ({ provider: 'gemini' as const, model: m.id, label: m.label })),
          ...data.openai
            .filter(m => m.id.startsWith('gpt-'))
            .map(m => ({ provider: 'openai' as const, model: m.id, label: `Whisper + ${m.label}` })),
        ];
        setTranscribeOptions(opts);
        // Pick persisted key if still valid, else first available
        setTranscribeModelKey(prev => {
          const valid = opts.find(o => o.model === prev);
          if (valid) return prev;
          const first = opts[0]?.model || '';
          if (first) localStorage.setItem(STORAGE_KEY_TRANSCRIBE, first);
          return first;
        });
      })
      .catch(() => {});
  }, []);

  const selectedOption = transcribeOptions.find(o => o.model === transcribeModelKey) || transcribeOptions[0];

  const handleTranscribeModelChange = (modelKey: string) => {
    setTranscribeModelKey(modelKey);
    localStorage.setItem(STORAGE_KEY_TRANSCRIBE, modelKey);
  };

  const fetchSuggestions = useCallback(async (query: string): Promise<Person[]> => {
    const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  const fetchDocumentSuggestions = useCallback(async (query: string): Promise<DocItem[]> => {
    const [notesRes, docsRes] = await Promise.all([
      fetch('/api/notes'),
      fetch('/api/documents?q=' + encodeURIComponent(query)).catch(() => null)
    ]);
    const notes = notesRes.ok ? await notesRes.json() : [];
    const docs = docsRes && docsRes.ok ? await docsRes.json() : [];
    
    let combined: DocItem[] = [
      ...notes.map((n: any) => ({ id: n.id, name: n.title || 'Untitled Note', type: 'note' as const })),
      ...(docs.documents || []).map((d: any) => ({ id: d.id, name: d.title || 'Untitled Document', type: 'document' as const }))
    ];
    if (query) {
      combined = combined.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    }
    return combined.slice(0, 10);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({ allowBase64: true, inline: false }),
      Placeholder.configure({ placeholder: note?.note_type === 'person' ? 'Write anything about this person...' : 'Start writing your note...' }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: async ({ query }) => fetchSuggestions(query),
          render: () => {
            let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
            let popup: TippyInstance[];

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props) => {
                component.updateProps(props);
                popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') { popup[0].hide(); return true; }
                const ref = component.ref as { onKeyDown?: (p: typeof props) => boolean } | null;
                return ref?.onKeyDown?.(props) ?? false;
              },
              onExit: () => { popup[0].destroy(); component.destroy(); },
            };
          },
        },
      }),
      DocumentMention.configure({
        HTMLAttributes: { class: 'document-mention', style: 'color: #00e5ff; background: rgba(0,229,255,0.1); border-radius: 4px; padding: 0 4px;' },
        suggestion: {
          char: '/',
          pluginKey: new PluginKey('documentMention'),
          items: async ({ query }) => fetchDocumentSuggestions(query),
          render: () => {
            let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
            let popup: TippyInstance[];

            return {
              onStart: (props) => {
                component = new ReactRenderer(DocumentMentionList, { props, editor: props.editor });
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props) => {
                component.updateProps(props);
                popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') { popup[0].hide(); return true; }
                const ref = component.ref as { onKeyDown?: (p: typeof props) => boolean } | null;
                return ref?.onKeyDown?.(props) ?? false;
              },
              onExit: () => { popup[0].destroy(); component.destroy(); },
            };
          },
        },
      }),
    ],
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(i => i.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        const reader = new FileReader();
        reader.onload = () => {
          view.dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src: reader.result as string })
            )
          );
        };
        reader.readAsDataURL(file);
        return true;
      },
    },
    content: note?.content || '',
    onUpdate: ({ editor }) => {
      const mentions: Person[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'mention') {
          const p = { id: node.attrs.id, name: node.attrs.label };
          if (!mentions.find(m => m.id === p.id)) mentions.push(p);
        }
      });
      setMentionedPeople(mentions);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => triggerSave(editor.getJSON(), editor.getText(), mentions), 1000);
    },
  });

  const triggerSave = useCallback((content: object, contentText: string, people: Person[]) => {
    onSave({ title, content, content_text: contentText, mention_ids: people.map(p => p.id) });
  }, [title, onSave]);

  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (!note) { setTitle(''); ed.commands.clearContent(); return; }
    setTitle(note.title);
    ed.commands.setContent(note.content || '');
    setMentionedPeople(note.note_mentions?.map(m => ({ id: m.person_id, name: m.people.name })) || []);
    setRenamingTitle(false);
    setTranscribeError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (editor) triggerSave(editor.getJSON(), editor.getText(), mentionedPeople);
    }, 1000);
  };

  const handleManualSave = () => {
    if (editor) triggerSave(editor.getJSON(), editor.getText(), mentionedPeople);
  };

  // ── Audio recording ─────────────────────────────────────────────────────────

  const startRecording = async () => {
    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setTranscribeError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const ed = editorRef.current;
      const existingText = ed?.getText()?.trim() || '';

      const formData = new FormData();
      formData.append('audio', blob, `recording-${Date.now()}.webm`);
      formData.append('provider', selectedOption.provider);
      formData.append('model', selectedOption.model);
      if (existingText) formData.append('existingContent', existingText);

      const res = await fetch('/api/notes/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');

      if (ed && data.html) {
        if (existingText) {
          // Append to end of existing content
          ed.commands.focus('end');
          ed.commands.insertContentAt(ed.state.doc.content.size, data.html);
        } else {
          // First recording — replace empty content
          ed.commands.setContent(data.html);
        }
        const mentions: Person[] = [];
        ed.state.doc.descendants(node => {
          if (node.type.name === 'mention') {
            const p = { id: node.attrs.id, name: node.attrs.label };
            if (!mentions.find(m => m.id === p.id)) mentions.push(p);
          }
        });
        triggerSave(ed.getJSON(), ed.getText(), mentions);
      }
    } catch (err: unknown) {
      setTranscribeError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  // ── Image insert ─────────────────────────────────────────────────────────────

  const insertImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(insertImageFromFile);
    e.target.value = '';
  };

  const setImageAlign = (align: 'left' | 'center' | 'right') => {
    editor?.chain().focus().updateAttributes('image', { 'data-align': align }).run();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!note) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        <Typography>Select a note or create a new one</Typography>
      </Box>
    );
  }

  const isBriefing = note.note_type === 'daily_briefing';
  const imageActive = editor?.isActive('image');

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        {/* Text format */}
        <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
          <ToggleButton value="bold" selected={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="italic" selected={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="underline" selected={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <FormatUnderlinedIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
          <ToggleButton value="bullet" selected={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <FormatListBulletedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="ordered" selected={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <FormatListNumberedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="code" selected={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
            <CodeIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Image align — shown when image is selected */}
        {imageActive && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
              <ToggleButton value="left" onClick={() => setImageAlign('left')} title="Align left">
                <FormatAlignLeftIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="center" onClick={() => setImageAlign('center')} title="Center">
                <FormatAlignCenterIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="right" onClick={() => setImageAlign('right')} title="Align right">
                <FormatAlignRightIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </>
        )}

        {/* Insert image */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageFileChange} />
        <Tooltip title="Insert image">
          <IconButton size="small" onClick={() => imageInputRef.current?.click()}>
            <ImageIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Daily Briefing: model selector + mic */}
        {isBriefing && (
          <>
            {/* Model dropdown */}
            <Select
              size="small"
              value={transcribeModelKey}
              onChange={e => handleTranscribeModelChange(e.target.value)}
              disabled={recording || transcribing || transcribeOptions.length === 0}
              displayEmpty
              sx={{
                fontSize: 12,
                height: 28,
                mr: 0.5,
                '& .MuiSelect-select': { py: '3px', pl: 1, pr: '24px !important' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                minWidth: 150,
                bgcolor: selectedOption?.provider === 'gemini'
                  ? 'rgba(52,211,153,0.07)'
                  : 'rgba(99,102,241,0.07)',
                color: selectedOption?.provider === 'gemini' ? 'success.main' : 'primary.light',
              }}
            >
              {transcribeOptions.length === 0 && (
                <MenuItem value="" disabled dense>
                  <Typography variant="caption" sx={{ fontSize: 12, opacity: 0.5 }}>Loading models…</Typography>
                </MenuItem>
              )}
              {transcribeOptions.map(opt => (
                <MenuItem key={opt.model} value={opt.model} dense>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      bgcolor: opt.provider === 'gemini' ? 'success.main' : 'primary.main',
                    }} />
                    <Typography variant="caption" sx={{ fontSize: 12 }}>{opt.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>

            {/* Mic / stop / spinner */}
            {transcribing ? (
              <Tooltip title={`Transcribing with ${selectedOption.label}...`}>
                <span><CircularProgress size={18} sx={{ mx: 0.5 }} /></span>
              </Tooltip>
            ) : (
              <Tooltip title={recording ? 'Stop & transcribe' : `Record voice note → ${selectedOption.label}`}>
                <IconButton
                  size="small"
                  onClick={recording ? stopRecording : startRecording}
                  sx={{
                    color: recording ? 'error.main' : 'text.secondary',
                    mr: 0.5,
                    animation: recording ? 'pulse 1.2s ease infinite' : 'none',
                  }}
                >
                  {recording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            {recording && <Chip label="Recording..." color="error" size="small" sx={{ mr: 0.5 }} />}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          </>
        )}

        {/* Delete */}
        {onDelete && (
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main', mr: 0.5 }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Save */}
        {saving ? (
          <CircularProgress size={16} />
        ) : (
          <Tooltip title="Save now (Ctrl+S)">
            <IconButton size="small" onClick={handleManualSave}>
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Transcribe error */}
      {transcribeError && (
        <Alert severity="error" onClose={() => setTranscribeError(null)} sx={{ mx: 2, mt: 1 }}>
          {transcribeError}
        </Alert>
      )}

      {/* Note metadata */}
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        {/* Title */}
        {note.note_type === 'person' ? (
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {renamingTitle ? (
              <TextField
                inputRef={renameTitleRef}
                variant="standard"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    await onRename?.(renameValue.trim());
                    setRenamingTitle(false);
                  } else if (e.key === 'Escape') {
                    setRenamingTitle(false);
                  }
                }}
                onBlur={async () => {
                  if (renameValue.trim() && renameValue.trim() !== title) {
                    await onRename?.(renameValue.trim());
                  }
                  setRenamingTitle(false);
                }}
                InputProps={{ disableUnderline: false, style: { fontSize: 28, fontWeight: 700 } }}
                sx={{ flex: 1 }}
                autoFocus
              />
            ) : (
              <Typography
                sx={{ fontSize: 28, fontWeight: 700, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                onClick={() => { setRenameValue(title); setRenamingTitle(true); setTimeout(() => renameTitleRef.current?.focus(), 30); }}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ mouseX: e.clientX, mouseY: e.clientY }); }}
              >
                {title}
              </Typography>
            )}
            <Chip size="small" label="Profile" color="secondary" variant="outlined" sx={{ ml: 1 }} />
            <Menu
              open={Boolean(contextMenu)}
              onClose={() => setContextMenu(null)}
              anchorReference="anchorPosition"
              anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
            >
              <MenuItem onClick={() => { setContextMenu(null); setRenameValue(title); setRenamingTitle(true); setTimeout(() => renameTitleRef.current?.focus(), 30); }}>
                Rename
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <TextField
            fullWidth
            variant="standard"
            placeholder="Untitled"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            InputProps={{ disableUnderline: true, style: { fontSize: 28, fontWeight: 700 } }}
            sx={{ mb: 1 }}
          />
        )}

        {/* Meta chips */}
        {note.note_type !== 'person' && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
            {note.note_date && <Chip size="small" label={note.note_date} variant="outlined" />}
            {note.event_title && <Chip size="small" icon={<EventIcon />} label={note.event_title} color="info" variant="outlined" />}
            {isBriefing && <Chip size="small" label="Daily Briefing" color="warning" variant="outlined" icon={<MicIcon sx={{ fontSize: 14 }} />} />}
          </Stack>
        )}

        {mentionedPeople.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
            {mentionedPeople.map(p => (
              <Chip key={p.id} size="small" label={`@${p.name}`} color="secondary" variant="outlined" />
            ))}
          </Stack>
        )}

        <Divider />
      </Box>

      {/* Editor content */}
      <Box sx={{
        flex: 1, overflowY: 'auto', px: 3, pb: 4,
        '& .ProseMirror': {
          outline: 'none',
          minHeight: 300,
          fontSize: 15,
          lineHeight: 1.7,
          '& p.is-editor-empty:first-child::before': {
            content: 'attr(data-placeholder)',
            color: '#aaa',
            pointerEvents: 'none',
            float: 'left',
            height: 0,
          },
          '& pre': {
            backgroundColor: '#1e1e1e',
            color: '#e8e8e8',
            borderRadius: '6px',
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: '13px',
            overflowX: 'auto',
            margin: '8px 0',
            lineHeight: 1.6,
          },
          '& pre code': {
            backgroundColor: 'transparent',
            color: 'inherit',
            padding: 0,
            fontSize: 'inherit',
          },
          '& code': {
            backgroundColor: '#f0f0f0',
            color: '#c7254e',
            borderRadius: '3px',
            padding: '1px 4px',
            fontFamily: 'monospace',
            fontSize: '13px',
          },
          '& .mention': {
            bgcolor: 'secondary.light',
            color: 'secondary.contrastText',
            borderRadius: 1,
            px: 0.5,
            fontWeight: 600,
          },
          // Images
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'block',
            margin: '8px 0',
            '&[data-align="left"]': { float: 'left', marginRight: '16px', marginBottom: '8px' },
            '&[data-align="right"]': { float: 'right', marginLeft: '16px', marginBottom: '8px' },
            '&[data-align="center"]': { marginLeft: 'auto', marginRight: 'auto' },
          },
          '& img.ProseMirror-selectednode': {
            outline: '2px solid',
            outlineColor: '#1976d2',
            borderRadius: '6px',
          },
        }
      }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
