-- ============================================================
-- Flow Me - Notes System
-- Run in Supabase SQL Editor
-- ============================================================

-- People (contacts referenced via @mentions)
CREATE TABLE IF NOT EXISTS public.people (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_people_user_id ON public.people(user_id);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own people" ON public.people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own people" ON public.people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own people" ON public.people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own people" ON public.people FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_people_updated_at
BEFORE UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB,                          -- TipTap JSON content
    content_text TEXT,                      -- Plain text for search
    note_date DATE,                         -- The day this note belongs to (for hierarchy)
    event_id TEXT,                          -- Google Calendar event ID (optional)
    event_title TEXT,                       -- Cached event title
    event_start TIMESTAMPTZ,               -- Cached event start
    note_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (note_type IN ('event', 'daily_briefing', 'manual')),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON public.notes(user_id, note_date);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON public.notes(user_id, created_at);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Note <-> People mentions
CREATE TABLE IF NOT EXISTS public.note_mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(note_id, person_id)
);

ALTER TABLE public.note_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own note mentions"
    ON public.note_mentions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.notes WHERE id = note_mentions.note_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert their own note mentions"
    ON public.note_mentions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE id = note_mentions.note_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete their own note mentions"
    ON public.note_mentions FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.notes WHERE id = note_mentions.note_id AND user_id = auth.uid()));
