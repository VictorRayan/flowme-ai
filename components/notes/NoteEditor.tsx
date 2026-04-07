'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import {
  Box, TextField, Typography, Chip, Stack, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, Divider, CircularProgress, Select,
  MenuItem, FormControl, InputLabel, Button, Menu
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
import MentionList from './MentionList';

interface Person {
  id: string;
  name: string;
  email?: string;
}

interface NoteData {
  id?: string;
  title: string;
  content: object | null;
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

export default function NoteEditor({ note, onSave, onRename, onDelete, saving }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [mentionedPeople, setMentionedPeople] = useState<Person[]>([]);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const renameTitleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const fetchSuggestions = useCallback(async (query: string): Promise<Person[]> => {
    const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
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
                // component.ref may be null when MentionList renders null (no items)
                const ref = component.ref as { onKeyDown?: (p: typeof props) => boolean } | null;
                return ref?.onKeyDown?.(props) ?? false;
              },
              onExit: () => { popup[0].destroy(); component.destroy(); },
            };
          },
        },
      }),
    ],
    content: note?.content || '',
    onUpdate: ({ editor }) => {
      // Track @mentions from editor content
      const mentions: Person[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'mention') {
          const p = { id: node.attrs.id, name: node.attrs.label };
          if (!mentions.find(m => m.id === p.id)) mentions.push(p);
        }
      });
      setMentionedPeople(mentions);

      // Auto-save after 1s of inactivity
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => triggerSave(editor.getJSON(), editor.getText(), mentions), 1000);
    },
  });

  const triggerSave = useCallback((content: object, contentText: string, people: Person[]) => {
    onSave({
      title,
      content,
      content_text: contentText,
      mention_ids: people.map(p => p.id),
    });
  }, [title, onSave]);

  // Keep stable ref so the effect below doesn't need editor as a dependency
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // Load note into editor when note id changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (!note) { setTitle(''); ed.commands.clearContent(); return; }
    setTitle(note.title);
    ed.commands.setContent(note.content || '');
    setMentionedPeople(
      note.note_mentions?.map(m => ({ id: m.person_id, name: m.people.name })) || []
    );
    setRenamingTitle(false);
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

  if (!note) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        <Typography>Select a note or create a new one</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {/* Format buttons */}
        <ToggleButtonGroup size="small" sx={{ mr: 1 }}>
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

        <ToggleButtonGroup size="small" sx={{ mr: 1 }}>
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

        <Box sx={{ flex: 1 }} />

        {/* Delete button */}
        {onDelete && (
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main', mr: 0.5 }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Save indicator */}
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
            {/* Right-click context menu */}
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

        {/* Meta: date, event, type — hidden for person profiles */}
        {note.note_type !== 'person' && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
            {note.note_date && (
              <Chip size="small" label={note.note_date} variant="outlined" />
            )}
            {note.event_title && (
              <Chip size="small" icon={<EventIcon />} label={note.event_title} color="info" variant="outlined" />
            )}
            {note.note_type === 'daily_briefing' && (
              <Chip size="small" label="Daily Briefing" color="warning" variant="outlined" />
            )}
          </Stack>
        )}

        {/* Mentioned people */}
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
        }
      }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
