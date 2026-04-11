-- ============================================================
-- Migration: 010_skills
-- Description: AI Skills system. External AIs can create,
-- read, and manage skills for AI processing workflows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                                  -- Skill identifier (e.g. "summarize_meeting")
    display_name TEXT NOT NULL,                          -- Human-readable name
    description TEXT,                                    -- What the skill does
    instructions TEXT NOT NULL,                          -- The actual AI instructions/prompt
    input_schema JSONB DEFAULT '{}',                     -- JSON Schema for expected inputs
    output_schema JSONB DEFAULT '{}',                    -- JSON Schema for expected outputs
    category TEXT DEFAULT 'general'
        CHECK (category IN ('general', 'calendar', 'notes', 'research', 'communication', 'automation', 'custom')),
    tags TEXT[] DEFAULT '{}',                             -- Searchable tags
    version INTEGER DEFAULT 1,                           -- Versioning for updates
    source TEXT DEFAULT 'user'
        CHECK (source IN ('user', 'system', 'external_ai')), -- Who created it
    source_agent TEXT,                                   -- e.g. "claude-3-opus", "gpt-4"
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON public.skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_category ON public.skills(user_id, category);
CREATE INDEX IF NOT EXISTS idx_skills_user_active ON public.skills(user_id, is_active) WHERE is_deleted = false;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skills" ON public.skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own skills" ON public.skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own skills" ON public.skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own skills" ON public.skills FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_skills_updated_at
BEFORE UPDATE ON public.skills
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Skill execution log (optional audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.skill_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    executed_by TEXT,                                     -- Which agent executed it
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON public.skill_executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_executions_skill ON public.skill_executions(skill_id);
ALTER TABLE public.skill_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill executions" ON public.skill_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own skill executions" ON public.skill_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
