'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Paper, Typography, InputBase, Divider, CircularProgress,
  List, ListItemButton, ListItemText, ListItemIcon, Chip
} from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import EventIcon from '@mui/icons-material/Event';
import dayjs from 'dayjs';

export interface ContextItem {
  kind: 'note' | 'event';
  id: string;
  label: string;       // display label
  subtitle?: string;   // date / time
  content: string;     // text to inject into prompt
}

interface NoteResult {
  id: string;
  title: string;
  note_date: string | null;
  content_text: string | null;
  note_type: string;
}

interface EventResult {
  id: string;
  title: string;
  start_at: string;
  end_at?: string;
  description?: string;
  participants?: { email: string; displayName?: string }[];
  location?: string;
}

interface CommandPaletteProps {
  anchorEl: HTMLElement | null;   // position relative to input box
  query: string;                  // text after "/"
  onSelect: (item: ContextItem) => void;
  onClose: () => void;
}

type Tab = 'notes' | 'events';

export default function CommandPalette({ anchorEl, query, onSelect, onClose }: CommandPaletteProps) {
  const [tab, setTab] = useState<Tab>('notes');
  const [notes, setNotes] = useState<NoteResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchNotes = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes/search?q=' + encodeURIComponent(q));
      if (res.ok) setNotes(await res.json());
    } finally { setLoading(false); }
  }, []);

  const fetchEvents = useCallback(async (q: string) => {
    setLoading(true);
    try {
      // Search last 365 days + next 365 days
      const start = dayjs().subtract(365, 'day').toISOString();
      const end = dayjs().add(365, 'day').toISOString();
      const res = await fetch(
        `/api/calendar/events?start=${start}&end=${end}&includeGoogleEvents=true&includeMicroactivities=true`
      );
      if (res.ok) {
        const data = await res.json();
        const all: EventResult[] = data.events || [];
        const filtered = q
          ? all.filter(e => e.title.toLowerCase().includes(q.toLowerCase()))
          : all.slice(0, 20);
        setEvents(filtered.slice(0, 20));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setHighlighted(0);
    if (tab === 'notes') fetchNotes(query);
    else fetchEvents(query);
  }, [query, tab, fetchNotes, fetchEvents]);

  const items: ContextItem[] = tab === 'notes'
    ? notes.map(n => ({
        kind: 'note' as const,
        id: n.id,
        label: n.title,
        subtitle: n.note_date ? dayjs(n.note_date).format('YYYY · MMMM · DD') : undefined,
        content: [
          `[Note: ${n.title}${n.note_date ? ` (${n.note_date})` : ''}]`,
          n.content_text || '(empty note)',
        ].join('\n'),
      }))
    : events.map(e => ({
        kind: 'event' as const,
        id: e.id,
        label: e.title,
        subtitle: e.start_at ? dayjs(e.start_at).format('YYYY-MM-DD HH:mm') : undefined,
        content: [
          `[Event: ${e.title}]`,
          `Time: ${e.start_at ? dayjs(e.start_at).format('MMM D YYYY, HH:mm') : 'unknown'}${e.end_at ? ' – ' + dayjs(e.end_at).format('HH:mm') : ''}`,
          e.description ? `Description: ${e.description}` : '',
          e.location ? `Location: ${e.location}` : '',
          e.participants?.length ? `Participants: ${e.participants.map(p => p.displayName || p.email).join(', ')}` : '',
        ].filter(Boolean).join('\n'),
      }));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
      if (e.key === 'Enter' && items[highlighted]) { e.preventDefault(); onSelect(items[highlighted]); }
      if (e.key === 'Tab') { e.preventDefault(); setTab(t => t === 'notes' ? 'events' : 'notes'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, highlighted, onClose, onSelect]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: Math.max(rect.width, 380),
        maxHeight: 360,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      {/* Tab bar */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
        {(['notes', 'events'] as Tab[]).map(t => (
          <Box
            key={t}
            onClick={() => setTab(t)}
            sx={{
              px: 2, py: 1, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5,
              color: tab === t ? 'primary.main' : 'text.secondary',
              borderBottom: tab === t ? '2px solid' : '2px solid transparent',
              borderColor: tab === t ? 'primary.main' : 'transparent',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {t === 'notes' ? 'Notes' : 'Events'}
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center', pr: 1.5 }}>
          Tab to switch · ↑↓ navigate · Enter select · Esc close
        </Typography>
      </Box>

      {/* Results */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ p: 2, textAlign: 'center' }}>
            {query ? `No ${tab} matching "${query}"` : `No ${tab} found`}
          </Typography>
        ) : (
          <List dense disablePadding ref={listRef} component="ul">
            {items.map((item, i) => (
              <ListItemButton
                key={item.id}
                selected={i === highlighted}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setHighlighted(i)}
                sx={{ px: 2, py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {item.kind === 'note'
                    ? <NoteIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    : <EventIcon fontSize="small" sx={{ color: 'info.main' }} />}
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" noWrap>{item.label}</Typography>}
                  secondary={item.subtitle && (
                    <Typography variant="caption" color="text.disabled" noWrap>{item.subtitle}</Typography>
                  )}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}
