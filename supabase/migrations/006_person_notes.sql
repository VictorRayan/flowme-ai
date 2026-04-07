-- ============================================================
-- Flow Me - Person profile notes
-- Run in Supabase SQL Editor
-- ============================================================

-- Extend note_type to allow 'person' profile notes
ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_note_type_check;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_note_type_check
  CHECK (note_type IN ('event', 'daily_briefing', 'manual', 'person'));

-- Add person_note_id to people: each person has one linked profile note
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS person_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL;
