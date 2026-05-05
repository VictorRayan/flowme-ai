-- ============================================================
-- Migration: 018_memory_facts
-- Description: Tier A persistent facts. Each row is a discrete fact
--              about the user that the assistant can recall across
--              all threads. Top-N loaded into every system prompt.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.memory_facts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    category TEXT,
    source_thread_id TEXT,
    confidence REAL DEFAULT 0.8,
    last_used_at TIMESTAMPTZ DEFAULT now(),
    use_count INT DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate active facts per user (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_facts_unique_active
    ON public.memory_facts (user_id, lower(fact))
    WHERE is_archived = FALSE;

-- Fast top-N load by recency among active facts.
CREATE INDEX IF NOT EXISTS idx_memory_facts_user_recent
    ON public.memory_facts (user_id, last_used_at DESC)
    WHERE is_archived = FALSE;

ALTER TABLE public.memory_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own facts" ON public.memory_facts;
CREATE POLICY "Users can view their own facts"
    ON public.memory_facts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own facts" ON public.memory_facts;
CREATE POLICY "Users can insert their own facts"
    ON public.memory_facts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own facts" ON public.memory_facts;
CREATE POLICY "Users can update their own facts"
    ON public.memory_facts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own facts" ON public.memory_facts;
CREATE POLICY "Users can delete their own facts"
    ON public.memory_facts FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_memory_facts_updated_at ON public.memory_facts;
CREATE TRIGGER trigger_update_memory_facts_updated_at
BEFORE UPDATE ON public.memory_facts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
