-- ============================================================
-- Migration: 021_threads_persisted
-- Description: Server-side persistence of Balys chat threads and
--              messages. Up until now threads lived only in browser
--              localStorage. Persisting enables cross-device sync,
--              real cron-based summarization, and Tier B recall over
--              full transcripts (not just rolling summaries).
--
-- Privacy note: messages contain user content. RLS strictly enforces
-- user_id = auth.uid() on every operation.
-- ============================================================

-- ----------- threads (the container) --------------------------
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New chat',
    provider TEXT,
    model TEXT,
    tier TEXT,
    route_label TEXT,
    execution_plan TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_user_recent
    ON public.threads (user_id, last_message_at DESC)
    WHERE is_archived = FALSE;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own threads" ON public.threads;
CREATE POLICY "Users can view their own threads"
    ON public.threads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own threads" ON public.threads;
CREATE POLICY "Users can insert their own threads"
    ON public.threads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON public.threads;
CREATE POLICY "Users can update their own threads"
    ON public.threads FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON public.threads;
CREATE POLICY "Users can delete their own threads"
    ON public.threads FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_threads_updated_at ON public.threads;
CREATE TRIGGER trigger_update_threads_updated_at
BEFORE UPDATE ON public.threads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------- thread_messages (each turn) ----------------------
CREATE TABLE IF NOT EXISTS public.thread_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL DEFAULT '',
    attachments JSONB,
    selected_action JSONB,
    transcript TEXT,
    thinking JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_chrono
    ON public.thread_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_thread_messages_user_recent
    ON public.thread_messages (user_id, created_at DESC);

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can view their own thread messages"
    ON public.thread_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can insert their own thread messages"
    ON public.thread_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can delete their own thread messages"
    ON public.thread_messages FOR DELETE USING (auth.uid() = user_id);

-- Touch threads.last_message_at on every new message
CREATE OR REPLACE FUNCTION touch_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_thread_last_message_at ON public.thread_messages;
CREATE TRIGGER trigger_touch_thread_last_message_at
AFTER INSERT ON public.thread_messages
FOR EACH ROW EXECUTE FUNCTION touch_thread_last_message_at();

-- ----------- thread_summaries: link to threads.id ------------
-- thread_summaries.thread_id was previously TEXT (matched localStorage IDs).
-- Now it should match threads.id (UUID). We keep it TEXT for backward compat
-- since localStorage IDs are also UUID strings, and we'll standardize via app.
