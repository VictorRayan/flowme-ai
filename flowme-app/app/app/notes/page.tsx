'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Fab, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import NotesTree, { NoteItem, PersonItem } from '@/components/notes/NotesTree';
import NoteEditor from '@/components/notes/NoteEditor';
import DeleteConfirmDialog from '@/components/notes/DeleteConfirmDialog';
import MeetingEntryButton from '@/components/meetings/MeetingEntryButton';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';
import { formatDate } from '@/lib/datetime';

interface FullNote extends Omit<NoteItem, 'note_type'> {
  content: object | null;
  event_start: string | null;
  note_type: 'event' | 'daily_briefing' | 'manual' | 'person';
}

type DeleteTarget =
  | { kind: 'note'; id: string; name: string }
  | { kind: 'person'; id: string; name: string };

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<FullNote | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [uiLang, setUiLang] = useState<UiLang>('en');
  const [focusEditor, setFocusEditor] = useState(false);
  const dailyBriefingLinkHandled = React.useRef(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => { if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchNotes = useCallback(async (personId?: string) => {
    const url = personId ? `/api/notes?person_id=${personId}` : '/api/notes';
    const res = await fetch(url);
    if (res.ok) setNotes(await res.json());
    setLoading(false);
  }, []);

  const fetchPeople = useCallback(async () => {
    const res = await fetch('/api/people');
    if (res.ok) setPeople(await res.json());
  }, []);

  // Ensure the current user's self-person exists, and cleanup legacy generated people once.
  useEffect(() => {
    let cancelled = false;
    const syncSelf = async () => {
      await fetch('/api/people/myself').catch(() => null);
      try {
        if (!localStorage.getItem('balysai_people_cleanup_v1')) {
          await fetch('/api/people/myself', { method: 'POST' }).catch(() => null);
          localStorage.setItem('balysai_people_cleanup_v1', '1');
        }
      } catch {}
      if (!cancelled) fetchPeople();
    };
    syncSelf();
    return () => { cancelled = true; };
  }, [fetchPeople]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Cross-tab invalidation: refetch when Balys writes to notes from another tab,
  // and also when this page becomes visible after Balys wrote in another tab.
  useEffect(() => {
    let lastFetchMillis = Date.now();
    const refetchAndStamp = () => { lastFetchMillis = Date.now(); fetchNotes(); };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'balysai_invalidate_notes') refetchAndStamp();
    };
    const refetchIfInvalidated = () => {
      try {
        const raw = localStorage.getItem('balysai_invalidate_notes');
        const ts = raw ? Number(raw) : 0;
        if (ts && ts > lastFetchMillis) refetchAndStamp();
      } catch {}
    };
    const handleFocus = () => refetchIfInvalidated();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') refetchIfInvalidated(); };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    refetchIfInvalidated();
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotes]);

  const handleSelectNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`);
    if (res.ok) setSelectedNote(await res.json());
  };

  const handleSelectPerson = (personId: string) => {
    if (selectedPersonId === personId) {
      setSelectedPersonId(null);
      fetchNotes();
    } else {
      setSelectedPersonId(personId);
      fetchNotes(personId);
    }
  };

  const handleOpenPersonNote = async (personId: string) => {
    const res = await fetch(`/api/people/${personId}/note`);
    const data = await res.json();
    if (res.ok) {
      const isPersonNote = data.event_id?.startsWith('person:');
      setSelectedNote({ ...data, note_type: isPersonNote ? 'person' : data.note_type });
      setSelectedPersonId(null);
    }
  };

  const handleRenamePerson = async (personId: string, newName: string) => {
    await fetch(`/api/people/${personId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    await fetchPeople();
    setSelectedNote(prev => {
      if (!prev) return prev;
      const isThisPersonNote = prev.event_id === `person:${personId}`;
      return isThisPersonNote ? { ...prev, title: newName } : prev;
    });
  };

  const handleAddPerson = async (name: string) => {
    const res = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const person = await res.json();
      await fetchPeople();
      await handleOpenPersonNote(person.id);
    }
  };

  const handleDeleteNote = async () => {
    if (deleteTarget?.kind !== 'note') return;
    await fetch(`/api/notes/${deleteTarget.id}`, { method: 'DELETE' });
    if (selectedNote?.id === deleteTarget.id) setSelectedNote(null);
    await fetchNotes();
  };

  const handleDeletePerson = async () => {
    if (deleteTarget?.kind !== 'person') return;
    await fetch(`/api/people/${deleteTarget.id}`, { method: 'DELETE' });
    // If their profile note is open, close it
    if (selectedNote?.event_id === `person:${deleteTarget.id}`) setSelectedNote(null);
    await fetchPeople();
    await fetchNotes();
  };

  const handleNewNote = async (opts?: { date?: string; note_type?: string; title?: string }) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts?.title || UI[uiLang].notes.untitled,
        note_date: opts?.date || dayjs().format('YYYY-MM-DD'),
        note_type: opts?.note_type || 'manual',
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      setSelectedPersonId(null);
      await fetchNotes();
      await fetchPeople();
      await handleSelectNote(id);
    }
  };

  const handleNewDailyBriefing = async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const existing = notes.find(n => n.note_type === 'daily_briefing' && n.note_date === today);
    if (existing) { await handleSelectNote(existing.id); return; }
    await handleNewNote({
      date: today,
      note_type: 'daily_briefing',
      title: UI[uiLang].notes.briefingTitle(formatDate(new Date(), 'MMM D, YYYY', uiLang)),
    });
  };

  useEffect(() => {
    if (loading || dailyBriefingLinkHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('daily_briefing')) return;
    dailyBriefingLinkHandled.current = true;
    setFocusEditor(params.get('focus') === 'editor');
    void handleNewDailyBriefing();
  }, [loading, notes]);

  const handleSave = useCallback(async (data: Parameters<typeof NoteEditor>[0]['onSave'] extends (d: infer D) => unknown ? D : never) => {
    if (!selectedNote?.id) return;
    setSaving(true);
    await fetch(`/api/notes/${selectedNote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSaving(false);
    const res = await fetch('/api/notes');
    if (res.ok) setNotes(await res.json());
    fetchPeople();
  }, [selectedNote?.id, fetchPeople]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ width: 260, borderRight: '1px solid', borderColor: 'divider', flexShrink: 0, overflow: 'hidden' }}>
        <NotesTree
          notes={notes}
          people={people}
          selectedId={selectedNote?.id || null}
          selectedPersonId={selectedPersonId}
          onSelect={handleSelectNote}
          onSelectPerson={handleSelectPerson}
          onOpenPersonNote={handleOpenPersonNote}
          onRenamePerson={handleRenamePerson}
          onAddPerson={handleAddPerson}
          onDeleteNote={(id, name) => setDeleteTarget({ kind: 'note', id, name })}
          onDeletePerson={(id, name) => setDeleteTarget({ kind: 'person', id, name })}
          onNewNote={handleNewNote}
          onNewDailyBriefing={handleNewDailyBriefing}
          lang={uiLang}
        />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <NoteEditor
          note={selectedNote}
          onSave={handleSave}
          saving={saving}
          autoFocus={focusEditor}
          lang={uiLang}
          onRename={selectedNote?.event_id?.startsWith('person:') ? async (newName) => {
            const personId = selectedNote.event_id!.replace('person:', '');
            await handleRenamePerson(personId, newName);
          } : undefined}
          onDelete={selectedNote ? () => setDeleteTarget({ kind: 'note', id: selectedNote.id!, name: selectedNote.title }) : undefined}
        />

        {!selectedNote && (
          <>
            <Box sx={{ position: 'absolute', bottom: 24, right: 24 + 70, zIndex: 1 }} data-testid="record-meeting-entry">
              <MeetingEntryButton variant="contained" size="medium" />
            </Box>
            <Tooltip title={UI[uiLang].notes.newNote}>
              <Fab color="primary" onClick={() => handleNewNote()} sx={{ position: 'absolute', bottom: 24, right: 24 }}>
                <AddIcon />
              </Fab>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTarget?.kind === 'person' ? handleDeletePerson : handleDeleteNote}
        title={deleteTarget?.kind === 'person'
          ? (uiLang === 'pt' ? `Excluir pessoa "${deleteTarget.name}"` : `Delete person "${deleteTarget.name}"`)
          : (uiLang === 'pt' ? `Excluir nota "${deleteTarget?.name}"` : `Delete note "${deleteTarget?.name}"`)}
        targetName={deleteTarget?.name || ''}
        confirmCount={deleteTarget?.kind === 'person' ? 2 : 1}
        description={deleteTarget?.kind === 'person'
          ? (uiLang === 'pt' ? 'Isso excluirá a pessoa e sua nota de perfil. Notas que a mencionam manterão as menções.' : 'This will delete the person and their profile note. Notes that mention them will keep the mentions.')
          : (uiLang === 'pt' ? 'Isso excluirá permanentemente esta nota.' : 'This will permanently delete this note.')}
      />
    </Box>
  );
}
