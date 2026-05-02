-- ============================================================
-- Migration: 019_thread_summaries
-- Description: Tier B cross-thread memory. One summary row per
--              thread with pgvector embedding for semantic recall
--              when the user references a past conversation.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.thread_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    embedding vector(1536),
    turn_count INT DEFAULT 0,
    summarized_at TIMESTAMPTZ DEFAULT now(),
    summary_version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- One summary per (user, thread). Replace on each rollover.
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_summaries_user_thread
    ON public.thread_summaries (user_id, thread_id);

-- Cosine-similarity search.
CREATE INDEX IF NOT EXISTS idx_thread_summaries_embedding
    ON public.thread_summaries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Recency fallback / "show me recent threads" listings.
CREATE INDEX IF NOT EXISTS idx_thread_summaries_user_recent
    ON public.thread_summaries (user_id, summarized_at DESC);

ALTER TABLE public.thread_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own thread summaries" ON public.thread_summaries;
CREATE POLICY "Users can view their own thread summaries"
    ON public.thread_summaries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own thread summaries" ON public.thread_summaries;
CREATE POLICY "Users can insert their own thread summaries"
    ON public.thread_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own thread summaries" ON public.thread_summaries;
CREATE POLICY "Users can update their own thread summaries"
    ON public.thread_summaries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own thread summaries" ON public.thread_summaries;
CREATE POLICY "Users can delete their own thread summaries"
    ON public.thread_summaries FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_thread_summaries_updated_at ON public.thread_summaries;
CREATE TRIGGER trigger_update_thread_summaries_updated_at
BEFORE UPDATE ON public.thread_summaries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
