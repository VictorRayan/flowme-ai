ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_note_type_check;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_note_type_check
  CHECK (note_type IN ('event', 'daily_briefing', 'manual', 'person', 'meeting'));

NOTIFY pgrst, 'reload schema';
