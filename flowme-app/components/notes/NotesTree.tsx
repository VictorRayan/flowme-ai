'use client';

import React, { useRef, useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, ListItemIcon, Collapse,
  Typography, IconButton, Tooltip, Divider, Chip, TextField, ClickAwayListener, Menu, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NoteIcon from '@mui/icons-material/Note';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PersonIcon from '@mui/icons-material/Person';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import AddIcon from '@mui/icons-material/Add';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import HubIcon from '@mui/icons-material/Hub';
import dayjs from 'dayjs';
import { UI, type UiLang } from '@/lib/i18n';
import { formatDate } from '@/lib/datetime';

export interface NoteItem {
  id: string;
  title: string;
  note_date: string | null;
  event_id: string | null;
  event_title: string | null;
  note_type: 'event' | 'daily_briefing' | 'manual' | 'person';
  created_at: string;
  note_mentions?: { person_id: string; people: { id: string; name: string } }[];
}

export interface PersonItem {
  id: string;
  name: string;
  email?: string;
  is_self?: boolean;
}

interface NotesTreeProps {
  notes: NoteItem[];
  people: PersonItem[];
  selectedId: string | null;
  selectedPersonId: string | null;
  onSelect: (id: string) => void;
  onSelectPerson: (personId: string) => void;
  onOpenPersonNote: (personId: string) => void;
  onAddPerson: (name: string) => Promise<void>;
  onRenamePerson: (personId: string, newName: string) => Promise<void>;
  onDeleteNote: (id: string, name: string) => void;
  onDeletePerson: (id: string, name: string) => void;
  onNewNote: (opts?: { date?: string; note_type?: string; title?: string }) => void;
  onNewDailyBriefing: () => void;
  lang: UiLang;
}

// Key by numeric year/month/day so sorting and reconstruction are locale-agnostic.
// Month/day NAMES are derived for display only, in the user's language.
function groupByDateHierarchy(notes: NoteItem[]) {
  const byYear: Record<string, Record<string, Record<string, NoteItem[]>>> = {};

  for (const note of notes) {
    if (note.note_date) {
      const d = dayjs(note.note_date);
      const y = d.format('YYYY');
      const m = d.format('MM');
      const day = d.format('DD');
      if (!byYear[y]) byYear[y] = {};
      if (!byYear[y][m]) byYear[y][m] = {};
      if (!byYear[y][m][day]) byYear[y][m][day] = [];
      byYear[y][m][day].push(note);
    }
  }

  return byYear;
}

import { useRouter } from 'next/navigation';

export default function NotesTree({ notes, people, selectedId, selectedPersonId, onSelect, onSelectPerson, onOpenPersonNote, onAddPerson, onRenamePerson, onDeleteNote, onDeletePerson, onNewNote, onNewDailyBriefing, lang }: NotesTreeProps) {
  const router = useRouter();
  const t = UI[lang].notes;
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [showBriefings, setShowBriefings] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [renamingPersonId, setRenamingPersonId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; personId: string } | null>(null);
  const [noteContextMenu, setNoteContextMenu] = useState<{ mouseX: number; mouseY: number; noteId: string; noteTitle: string } | null>(null);
  const newPersonInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const today = dayjs().format('YYYY-MM-DD');
  const briefingNotes = notes.filter(n => n.note_type === 'daily_briefing').sort((a, b) => (b.note_date || '').localeCompare(a.note_date || ''));
  const todaysBriefing = briefingNotes.find(n => n.note_date === today);
  const pastBriefings = briefingNotes.filter(n => n.note_date !== today);
  const byYear = groupByDateHierarchy(notes.filter(n => n.note_type !== 'daily_briefing'));

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) => {
    setter(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const noteIcon = (type: NoteItem['note_type']) => {
    if (type === 'daily_briefing') return <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main' }} />;
    if (type === 'event') return <EventNoteIcon fontSize="small" sx={{ color: 'info.main' }} />;
    return <NoteIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  };

  // Count notes per person
  const notesPerPerson = (personId: string) =>
    notes.filter(n => n.note_mentions?.some(m => m.person_id === personId)).length;

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
          {t.notes}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={t.neuralGraph}>
            <IconButton size="small" onClick={() => router.push('/app/notes/graph')}>
              <HubIcon fontSize="small" sx={{ color: 'primary.main' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.newNote}>
            <IconButton size="small" onClick={() => onNewNote()}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Divider />

      <List dense disablePadding>
        {/* ── Daily Briefing section ── */}
        <ListItemButton onClick={() => setShowBriefings(p => !p)} sx={{ pl: 1 }}>
          <ListItemIcon sx={{ minWidth: 24 }}>
            {showBriefings ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </ListItemIcon>
          <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main', mr: 1 }} />
          <ListItemText primary={<Typography variant="body2" fontWeight="bold">{t.dailyBriefing}</Typography>} />
          {briefingNotes.length > 0 && <Chip label={briefingNotes.length} size="small" sx={{ height: 16, fontSize: 10, mr: 0.5 }} />}
          <Tooltip title={t.newBriefingToday}>
            <IconButton size="small" onClick={e => { e.stopPropagation(); onNewDailyBriefing(); }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemButton>

        <Collapse in={showBriefings} unmountOnExit>
          {/* Today's briefing or create prompt */}
          <Box sx={{ pl: 3, pr: 1, py: 0.25 }}>
            <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>{t.todayGroup}</Typography>
          </Box>
          {todaysBriefing ? (
            <ListItemButton
              selected={selectedId === todaysBriefing.id}
              onClick={() => onSelect(todaysBriefing.id)}
              onContextMenu={e => { e.preventDefault(); setNoteContextMenu({ mouseX: e.clientX, mouseY: e.clientY, noteId: todaysBriefing.id, noteTitle: todaysBriefing.title }); }}
              sx={{ pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 24 }}>
                <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main' }} />
              </ListItemIcon>
              <ListItemText primary={<Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>{todaysBriefing.title}</Typography>} />
            </ListItemButton>
          ) : (
            <ListItemButton onClick={onNewDailyBriefing} sx={{ pl: 4 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <AddIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </ListItemIcon>
              <ListItemText primary={<Typography variant="body2" color="text.disabled">{t.createTodayBriefing}</Typography>} />
            </ListItemButton>
          )}

          {/* Past briefings */}
          {pastBriefings.length > 0 && (
            <Box sx={{ pl: 3, pr: 1, pt: 0.5, pb: 0.25 }}>
              <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>{t.pastGroup}</Typography>
            </Box>
          )}
          {pastBriefings.map(note => (
            <ListItemButton
              key={note.id}
              selected={selectedId === note.id}
              onClick={() => onSelect(note.id)}
              onContextMenu={e => { e.preventDefault(); setNoteContextMenu({ mouseX: e.clientX, mouseY: e.clientY, noteId: note.id, noteTitle: note.title }); }}
              sx={{ pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 24 }}>
                <WbSunnyIcon fontSize="small" sx={{ color: 'warning.light' }} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" noWrap sx={{ maxWidth: 110 }}>{note.title}</Typography>}
                secondary={note.note_date ? <Typography variant="caption" color="text.disabled">{formatDate(note.note_date, 'MMM D, YYYY', lang)}</Typography> : undefined}
              />
            </ListItemButton>
          ))}
        </Collapse>

        <Divider sx={{ my: 1 }} />

        {/* Date hierarchy */}
        {Object.keys(byYear).sort((a, b) => b.localeCompare(a)).map(year => (
          <React.Fragment key={year}>
            <ListItemButton onClick={() => toggle(setExpandedYears, year)} sx={{ pl: 1 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                {expandedYears[year] ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText primary={<Typography variant="body2" fontWeight="bold">{year}</Typography>} />
            </ListItemButton>

            <Collapse in={expandedYears[year]} unmountOnExit>
              {Object.keys(byYear[year]).sort((a, b) => b.localeCompare(a)).map(month => (
                <React.Fragment key={month}>
                  <ListItemButton onClick={() => toggle(setExpandedMonths, `${year}-${month}`)} sx={{ pl: 3 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      {expandedMonths[`${year}-${month}`] ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText primary={<Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{formatDate(`${year}-${month}-01`, 'MMMM', lang)}</Typography>} />
                  </ListItemButton>

                  <Collapse in={expandedMonths[`${year}-${month}`]} unmountOnExit>
                    {Object.keys(byYear[year][month]).sort((a, b) => b.localeCompare(a)).map(day => {
                      const dayKey = `${year}-${month}-${day}`;
                      const dayNotes = byYear[year][month][day];
                      const dateStr = `${year}-${month}-${day}`;
                      return (
                        <React.Fragment key={day}>
                          <ListItemButton onClick={() => toggle(setExpandedDays, dayKey)} sx={{ pl: 5 }}>
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              {expandedDays[dayKey] ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{formatDate(dateStr, 'ddd, MMM D', lang)}</Typography>
                                  <Chip label={dayNotes.length} size="small" sx={{ height: 16, fontSize: 10 }} />
                                </Box>
                              }
                            />
                            <Tooltip title={t.addNoteToDay}>
                              <IconButton size="small" onClick={e => { e.stopPropagation(); onNewNote({ date: dateStr }); }}>
                                <AddIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </ListItemButton>

                          <Collapse in={expandedDays[dayKey]} unmountOnExit>
                            {dayNotes.map(note => (
                              <ListItemButton
                                key={note.id}
                                selected={selectedId === note.id}
                                onClick={() => onSelect(note.id)}
                                onContextMenu={e => { e.preventDefault(); setNoteContextMenu({ mouseX: e.clientX, mouseY: e.clientY, noteId: note.id, noteTitle: note.title }); }}
                                sx={{ pl: 7 }}
                              >
                                <ListItemIcon sx={{ minWidth: 24 }}>{noteIcon(note.note_type)}</ListItemIcon>
                                <ListItemText primary={<Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{note.title}</Typography>} />
                              </ListItemButton>
                            ))}
                          </Collapse>
                        </React.Fragment>
                      );
                    })}
                  </Collapse>
                </React.Fragment>
              ))}
            </Collapse>
          </React.Fragment>
        ))}

        {/* People section — flat list, always visible */}
        <Divider sx={{ my: 1 }} />
        <ListItemButton onClick={() => setShowPeople(p => !p)} sx={{ pl: 1 }}>
          <ListItemIcon sx={{ minWidth: 24 }}>
            {showPeople ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" fontWeight="bold">{t.people}</Typography>} />
          {people.length > 0 && <Chip label={people.length} size="small" sx={{ height: 16, fontSize: 10, mr: 0.5 }} />}
          <Tooltip title={t.addPerson}>
            <IconButton size="small" onClick={e => {
              e.stopPropagation();
              setShowPeople(true);
              setAddingPerson(true);
              setTimeout(() => newPersonInputRef.current?.focus(), 50);
            }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemButton>

        <Collapse in={showPeople} unmountOnExit>
          {/* Inline new person input */}
          {addingPerson && (
            <ClickAwayListener onClickAway={() => { setAddingPerson(false); setNewPersonName(''); }}>
              <Box sx={{ pl: 3, pr: 1, py: 0.5 }}>
                <TextField
                  inputRef={newPersonInputRef}
                  size="small"
                  fullWidth
                  placeholder={t.namePlaceholder}
                  value={newPersonName}
                  onChange={e => setNewPersonName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newPersonName.trim()) {
                      await onAddPerson(newPersonName.trim());
                      setNewPersonName('');
                      setAddingPerson(false);
                    } else if (e.key === 'Escape') {
                      setAddingPerson(false);
                      setNewPersonName('');
                    }
                  }}
                  InputProps={{ sx: { fontSize: 13 } }}
                />
              </Box>
            </ClickAwayListener>
          )}
          {people.length === 0 && !addingPerson && (
            <Box sx={{ pl: 4, py: 1 }}>
              <Typography variant="caption" color="text.disabled">{t.addPeopleEmpty}</Typography>
            </Box>
          )}
          {people.map(person => {
            const count = notesPerPerson(person.id);
            const isMyself = Boolean(person.is_self || person.name === 'Myself');
            const isRenaming = renamingPersonId === person.id;

            return (
              <ListItemButton
                key={person.id}
                selected={selectedPersonId === person.id}
                onClick={() => { if (!isRenaming) onOpenPersonNote(person.id); }}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, personId: person.id }); }}
                sx={{ pl: 3, pr: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <PersonIcon fontSize="small" sx={{ color: isMyself ? 'primary.main' : 'secondary.main' }} />
                </ListItemIcon>
                <ListItemText primary={
                  isRenaming ? (
                    <ClickAwayListener onClickAway={async () => {
                      if (renameValue.trim() && renameValue.trim() !== person.name) {
                        await onRenamePerson(person.id, renameValue.trim());
                      }
                      setRenamingPersonId(null);
                    }}>
                      <TextField
                        inputRef={renameInputRef}
                        size="small"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={async e => {
                          e.stopPropagation();
                          if (e.key === 'Enter' && renameValue.trim()) {
                            if (renameValue.trim() !== person.name) {
                              await onRenamePerson(person.id, renameValue.trim());
                            }
                            setRenamingPersonId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingPersonId(null);
                          }
                        }}
                        variant="standard"
                        InputProps={{ disableUnderline: false, sx: { fontSize: 14 } }}
                        sx={{ width: '100%' }}
                      />
                    </ClickAwayListener>
                  ) : (
                    <Typography variant="body2" fontWeight={isMyself ? 'bold' : 'normal'}>
                      {person.name}
                    </Typography>
                  )
                } />
                {!isRenaming && count > 0 && (
                  <Tooltip title={t.notesMentioning(count, person.name)}>
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onSelectPerson(person.id); }}
                      color={selectedPersonId === person.id ? 'primary' : 'default'}
                      sx={{ p: 0.3 }}>
                      <FilterAltIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {!isRenaming && count > 0 && <Chip label={count} size="small" sx={{ height: 16, fontSize: 10, ml: 0.5 }} />}
              </ListItemButton>
            );
          })}

          {/* Context menu for right-click on person */}
          <Menu
            open={Boolean(contextMenu)}
            onClose={() => setContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
          >
            <MenuItem onClick={() => {
              const person = people.find(p => p.id === contextMenu?.personId);
              if (person) { setRenameValue(person.name); setRenamingPersonId(person.id); setTimeout(() => renameInputRef.current?.focus(), 50); }
              setContextMenu(null);
            }}>
              {t.rename}
            </MenuItem>
            <MenuItem sx={{ color: 'error.main' }} onClick={() => {
              const person = people.find(p => p.id === contextMenu?.personId);
              if (person) onDeletePerson(person.id, person.name);
              setContextMenu(null);
            }}>
              {t.delete}
            </MenuItem>
          </Menu>

          {/* Context menu for right-click on note */}
          <Menu
            open={Boolean(noteContextMenu)}
            onClose={() => setNoteContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={noteContextMenu ? { top: noteContextMenu.mouseY, left: noteContextMenu.mouseX } : undefined}
          >
            <MenuItem sx={{ color: 'error.main' }} onClick={() => {
              if (noteContextMenu) onDeleteNote(noteContextMenu.noteId, noteContextMenu.noteTitle);
              setNoteContextMenu(null);
            }}>
              {t.delete}
            </MenuItem>
          </Menu>
        </Collapse>
      </List>
    </Box>
  );
}
