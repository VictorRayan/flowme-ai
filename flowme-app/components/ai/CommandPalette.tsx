'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Paper, Typography, InputBase, Divider, CircularProgress,
  List, ListItemButton, ListItemText, ListItemIcon, Chip
} from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import EventIcon from '@mui/icons-material/Event';
import GroupsIcon from '@mui/icons-material/Groups';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import EditNoteIcon from '@mui/icons-material/EditNote';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';
import SlackBrandIcon from '@/components/icons/SlackBrandIcon';
import GmailBrandIcon from '@/components/icons/GmailBrandIcon';
import GoogleDocsBrandIcon from '@/components/icons/GoogleDocsBrandIcon';
import GoogleSheetsBrandIcon from '@/components/icons/GoogleSheetsBrandIcon';
import GoogleDriveBrandIcon from '@/components/icons/GoogleDriveBrandIcon';
import { type UiLang } from '@/lib/i18n';
import dayjs from 'dayjs';

export type CommandAction =
  | 'council'
  | 'briefing'
  | 'note'
  | 'weather'
  | 'gmail'
  | 'drive'
  | 'docs'
  | 'sheets'
  | 'slack'
  | 'image'
  | 'meeting'
  | 'reminder';

export interface ContextItem {
  kind: 'note' | 'event' | 'action';
  id: string;
  label: string;       // display label
  subtitle?: string;   // date / time
  content: string;     // for 'note'/'event': context block to inject; for 'action': directive prefix
  action?: CommandAction;
}

interface ActionDef {
  id: string;
  command: string;
  label: string;
  subtitle: string;
  directive: string;
  action: CommandAction;
  aliases: string[];
}

type Tab = 'actions' | 'notes' | 'events';

const PALETTE_TEXT: Record<UiLang, {
  tabs: Record<Tab, string>;
  help: string;
  empty: (tab: string, query: string) => string;
}> = {
  en: {
    tabs: { actions: 'Actions', notes: 'Notes', events: 'Events' },
    help: 'Tab switch - arrows navigate - Enter select - Esc close',
    empty: (tab, query) => query ? `No ${tab} matching "${query}"` : `No ${tab} found`,
  },
  pt: {
    tabs: { actions: 'Acoes', notes: 'Notas', events: 'Eventos' },
    help: 'Tab alterna - setas navegam - Enter seleciona - Esc fecha',
    empty: (tab, query) => query ? `Nenhum resultado em ${tab} para "${query}"` : `Nada em ${tab}`,
  },
};

function getActions(uiLang: UiLang): ActionDef[] {
  const pt = uiLang === 'pt';
  return [
    {
      id: 'council',
      command: pt ? '/conselho' : '/council',
      label: pt ? '/conselho' : '/council',
      subtitle: pt ? 'Convocar o conselho de especialistas' : 'Convene the expert council',
      directive: 'Use council.convene to deliberate on the situation. Brief the council with the full context the user provided.',
      action: 'council',
      aliases: ['/council', '/conselho', 'conselho', 'council'],
    },
    {
      id: 'briefing',
      command: '/briefing',
      label: '/briefing',
      subtitle: pt ? 'Gerar o briefing de hoje' : 'Generate today\'s daily briefing',
      directive: 'Generate the daily briefing: top calendar events, recent notes, important emails, and 1-3 priorities. Use tools before making claims.',
      action: 'briefing',
      aliases: ['/briefing', 'resumo', 'rotina', 'daily'],
    },
    {
      id: 'note',
      command: pt ? '/nota' : '/note',
      label: pt ? '/nota' : '/note',
      subtitle: pt ? 'Salvar a proxima mensagem como nota' : 'Save the next message as a note',
      directive: 'Treat the user message as content to save as a new note. Pick a short title and call notes.create_note. Confirm naturally.',
      action: 'note',
      aliases: ['/note', '/nota', 'nota', 'note'],
    },
    {
      id: 'weather',
      command: pt ? '/clima' : '/weather',
      label: pt ? '/clima' : '/weather',
      subtitle: pt ? 'Clima atual e previsao' : 'Current weather and forecast',
      directive: 'Call weather.get. If the user typed a city after the shortcut, use that city. If userLocation coordinates are in context, use them. Otherwise ask for the city.',
      action: 'weather',
      aliases: ['/weather', '/clima', 'tempo', 'clima', 'weather'],
    },
    {
      id: 'gmail',
      command: '/gmail',
      label: '/gmail',
      subtitle: pt ? 'Procurar emails, ler contexto e criar rascunhos' : 'Search email, read context, and draft replies',
      directive: 'Use connectors.list to verify Gmail access, then gmail.search_messages to search and select relevant messages. If the user asks what an email says, asks for insight from a specific email, or asks for a reply based on an email, call gmail.read_message before answering or drafting. Treat snippets as discovery only. If the user asks for a reply, draft with gmail.create_draft only after recipients and content are clear.',
      action: 'gmail',
      aliases: ['/gmail', 'email', 'emails', 'e-mail', 'correio'],
    },
    {
      id: 'drive',
      command: '/drive',
      label: '/drive',
      subtitle: pt ? 'Descobrir arquivos no Drive e ler o selecionado' : 'Discover Drive files and read the selected one',
      directive: 'Use connectors.list to find an authorized Google Drive connector. Use connectors.search_docs to list or search Drive files. After selecting the relevant file internally, call connectors.read_drive_file to read it, then summarize or extract insights.',
      action: 'drive',
      aliases: ['/drive', 'arquivo', 'arquivos', 'pasta', 'folder'],
    },
    {
      id: 'docs',
      command: '/docs',
      label: '/docs',
      subtitle: pt ? 'Criar, buscar, ler, editar e resumir documentos' : 'Create, find, read, edit, and summarize documents',
      directive: 'Use connectors.list to find an authorized Google Docs connector. If the user wants a new document, draft the content and call connectors.create_doc. If the user pasted a Google Docs URL or named a document, use connectors.find_and_read_doc to read it intuitively before summarizing or deciding where to edit. Use connectors.search_docs to list documents. Use connectors.docs_agent for requested edits, passing the URL/file_id or keeping the URL in the task.',
      action: 'docs',
      aliases: ['/docs', '/documentos', 'doc', 'docs', 'documento', 'documentos'],
    },
    {
      id: 'sheets',
      command: pt ? '/planilhas' : '/sheets',
      label: pt ? '/planilhas' : '/sheets',
      subtitle: pt ? 'Buscar, ler, editar e analisar planilhas' : 'Find, read, edit, and analyze spreadsheets',
      directive: 'Use connectors.list to find an authorized Google Sheets connector. Use connectors.search_docs to list or search spreadsheets. After selecting the relevant spreadsheet internally, use connectors.sheets_agent with mode="analyze" for financial insights or mode="edit" for formulas/edits. Use connectors.read_sheet for simple range reads. Extract insights from actual rows and the economist agent receipts.',
      action: 'sheets',
      aliases: ['/sheets', '/planilhas', '/planilha', 'sheets', 'sheet', 'planilha', 'planilhas'],
    },
    {
      id: 'slack',
      command: '/slack',
      label: '/slack',
      subtitle: pt ? 'Buscar, ler e responder mensagens no Slack' : 'Search, read and reply to Slack messages',
      directive: 'Use connectors.list to verify the Slack connector is active. Then pick the right tool based on the user intent:\n- KEYWORD search (user gives a name, topic, phrase) → slack.search_messages with their term. Supports Slack operators (from:@user, in:#channel, before:YYYY-MM-DD).\n- BROWSE / "what is recent" / specific channel mention → slack.list_channels to resolve names → slack.read_channel on the relevant one. Never call slack.search_messages without a non-empty search term.\n- THREAD context → slack.read_thread with channel + thread_ts.\n- USER profile lookup → slack.get_user to turn a Slack user ID into a real name.\n- POST a message → slack.send_message with confirmed=true ONLY after the user has explicitly confirmed both the message text and the destination channel/DM. Always show the draft and ask for confirmation first.\nIf the channel or recipient is ambiguous, ask one short clarifying question before acting.',
      action: 'slack',
      aliases: ['/slack', 'slack', 'mensagem do slack', 'slack messages', 'slack search'],
    },
    {
      id: 'meeting',
      command: pt ? '/reuniao' : '/meeting',
      label: pt ? '/reuniao' : '/meeting',
      subtitle: pt ? 'Resumir e buscar nas suas reuniões gravadas' : 'Summarize and search your recorded meetings',
      directive: 'Use the meetings.* tools to answer:\n- "minhas últimas reuniões" → meetings.list_recent (default limit 10).\n- "resume a reunião X" / "que tasks saíram dela" → meetings.list_recent to find the id, then meetings.get_detail with include_transcript=true.\n- "quem me falou de X?" / "o que falamos sobre Y?" → meetings.search_segments with the keyword (>=2 chars). For broader date windows pass since_days.\n- The user cannot start a new recording through chat — direct them to the "Gravar reunião" button in Notes for that. Only answer questions about EXISTING meetings.\nReference meetings by title and date in your reply, never by raw id. When quoting transcript snippets, attribute them to the speaker_label exactly as returned by the tool.',
      action: 'meeting',
      aliases: ['/meeting', '/reuniao', '/reunião', '/reunioes', 'reuniao', 'meeting', 'meetings', 'reuniões'],
    },
    {
      id: 'image',
      command: pt ? '/imagem' : '/image',
      label: pt ? '/imagem' : '/image',
      subtitle: pt ? 'Gerar uma imagem a partir de uma descrição' : 'Generate an image from a description',
      directive: 'Generate an image from the user description with images.generate. Preserve requested visual style, composition, aspect ratio, and text. If the description is missing, ask one short question before calling the tool.',
      action: 'image',
      aliases: ['/image', '/imagem', 'imagem', 'image', 'gerar imagem', 'generate image'],
    },
    {
      id: 'reminder',
      command: pt ? '/lembrete' : '/reminder',
      label: pt ? '/lembrete' : '/reminder',
      subtitle: pt ? 'Criar um lembrete passo a passo' : 'Create a reminder step by step',
      directive: 'The user wants to create a reminder. Gather information before calling reminders.create. Required: a short message (what to remind), an exact date AND time of day in the user\'s timezone. If the user typed text after /lembrete or /reminder, treat it as initial intent and extract whatever message/date/time you can. For each missing field, ask ONE short question (e.g. "Que horas amanhã?", "Qual a mensagem do lembrete?"). Resolve relative dates ("amanhã", "tomorrow", "daqui 2 horas") using the Current local date/time line and the user\'s timezone. Never default times silently and never call reminders.create with missing/undefined fields. Once all info is confirmed, call reminders.create with channel_preference="default".',
      action: 'reminder',
      aliases: ['/reminder', '/lembrete', '/lembrar', 'lembrete', 'reminder', 'remind'],
    },
  ];
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
  source?: string;
  linked_account_id?: string;
  account_name?: string;
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
  uiLang?: UiLang;
  onSelect: (item: ContextItem) => void;
  onClose: () => void;
}

export default function CommandPalette({ anchorEl, query, uiLang = 'en', onSelect, onClose }: CommandPaletteProps) {
  const [tab, setTab] = useState<Tab>('actions');
  const [notes, setNotes] = useState<NoteResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const text = PALETTE_TEXT[uiLang];
  const actions = getActions(uiLang);

  const fetchNotes = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      if (res.ok) setNotes(Array.isArray(data) ? data : []);
      else console.error('[CommandPalette] notes search error:', data);
    } catch (e) {
      console.error('[CommandPalette] notes fetch failed:', e);
    } finally { setLoading(false); }
  }, []);

  const fetchEvents = useCallback(async (q: string) => {
    setLoading(true);
    try {
      // Search last 365 days + next 365 days
      const start = dayjs().subtract(365, 'day').toISOString();
      const end = dayjs().add(365, 'day').toISOString();
      const res = await fetch(
        `/api/calendar/events?start=${start}&end=${end}&includeGoogleEvents=true&includeFlowmeEvents=true`
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
    else if (tab === 'events') fetchEvents(query);
  }, [query, tab, fetchNotes, fetchEvents]);

  const filteredActions = actions.filter(a => {
    if (!query) return true;
    const q = query.toLowerCase();
    return a.command.toLowerCase().includes(q)
      || a.subtitle.toLowerCase().includes(q)
      || a.aliases.some(alias => alias.toLowerCase().includes(q));
  });

  const items: ContextItem[] = tab === 'actions'
    ? filteredActions.map(a => ({
        kind: 'action' as const,
        id: a.id,
        label: a.label,
        subtitle: a.subtitle,
        content: a.directive,
        action: a.action,
      }))
    : tab === 'notes'
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
          `Event ID: ${e.id}`,
          e.source ? `Source: ${e.source}` : '',
          e.linked_account_id ? `Linked Account ID: ${e.linked_account_id}` : '',
          e.account_name ? `Account: ${e.account_name}` : '',
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
      if (e.key === 'Tab') {
        e.preventDefault();
        setTab(t => t === 'actions' ? 'notes' : t === 'notes' ? 'events' : 'actions');
      }
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
        {(['actions', 'notes', 'events'] as Tab[]).map(t => (
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
            {text.tabs[t]}
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center', pr: 1.5 }}>
          {text.help}
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
            {text.empty(text.tabs[tab].toLowerCase(), query)}
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
                  {item.kind === 'action'
                    ? (item.action === 'council'
                        ? <GroupsIcon fontSize="small" sx={{ color: 'secondary.main' }} />
                        : item.action === 'briefing'
                          ? <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main' }} />
                          : item.action === 'weather'
                            ? <WbSunnyIcon fontSize="small" sx={{ color: '#38bdf8' }} />
                            : item.action === 'gmail'
                              ? <GmailBrandIcon fontSize="small" />
                              : item.action === 'drive'
                                ? <GoogleDriveBrandIcon fontSize="small" />
                                : item.action === 'docs'
                                  ? <GoogleDocsBrandIcon fontSize="small" />
                                  : item.action === 'sheets'
                                    ? <GoogleSheetsBrandIcon fontSize="small" />
                                    : item.action === 'slack'
                                      ? <SlackBrandIcon fontSize="small" />
                                      : item.action === 'image'
                                        ? <ImageIcon fontSize="small" sx={{ color: '#c084fc' }} />
                                      : item.action === 'meeting'
                                        ? <MicIcon fontSize="small" sx={{ color: '#fb7185' }} />
                                      : <EditNoteIcon fontSize="small" sx={{ color: 'success.main' }} />)
                    : item.kind === 'note'
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
