-- Run this entire file in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dqzxnnirorwnypzglsxd/sql/new
--
-- Live DB catch-up for Flowme AI migrations 012-023.
-- Safe to re-run: objects use IF NOT EXISTS where possible; policies and
-- triggers are dropped/recreated when Supabase does not support IF NOT EXISTS.

-- ============================================================
-- 012: task columns on microactivities + smart_goals
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.task_category AS ENUM ('non_negotiable', 'negotiable', 'routine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('not_started', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS category public.task_category DEFAULT 'negotiable',
  ADD COLUMN IF NOT EXISTS status public.task_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;

UPDATE public.microactivities SET scheduled_date = start_at::DATE WHERE scheduled_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_microact_user_date ON public.microactivities(user_id, scheduled_date);

-- Shared updated_at trigger helper. Migration 000 normally creates this, but
-- the dashboard catch-up should be self-contained.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 013: user_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    morning_rhythm_time TIME,
    evening_rhythm_time TIME,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
    ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
    ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
    ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trigger_update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rhythm_logs'
  ) THEN
    ALTER TABLE public.rhythm_logs
    ALTER COLUMN council_feedback TYPE JSONB USING council_feedback::JSONB;
  END IF;
END $$;

-- ============================================================
-- 014: connectors
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.connector_type AS ENUM (
    'gmail', 'google_docs', 'google_sheets', 'google_drive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.connectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.connector_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connectors_user ON public.connectors(user_id);
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own connectors" ON public.connectors;
CREATE POLICY "Users can view their own connectors"
  ON public.connectors FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own connectors" ON public.connectors;
CREATE POLICY "Users can insert their own connectors"
  ON public.connectors FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own connectors" ON public.connectors;
CREATE POLICY "Users can update their own connectors"
  ON public.connectors FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own connectors" ON public.connectors;
CREATE POLICY "Users can delete their own connectors"
  ON public.connectors FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 015: tasks extensions
-- ============================================================
ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS priority SMALLINT DEFAULT 0 CHECK (priority >= 0 AND priority <= 3),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

CREATE TABLE IF NOT EXISTS public.action_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  linked_goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
  status public.goal_status DEFAULT 'not_started',
  duration_days INTEGER DEFAULT 21,
  starts_on DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plans_user ON public.action_plans(user_id);
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own action plans" ON public.action_plans;
CREATE POLICY "Users can view their own action plans"
  ON public.action_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own action plans" ON public.action_plans;
CREATE POLICY "Users can insert their own action plans"
  ON public.action_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own action plans" ON public.action_plans;
CREATE POLICY "Users can update their own action plans"
  ON public.action_plans FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own action plans" ON public.action_plans;
CREATE POLICY "Users can delete their own action plans"
  ON public.action_plans FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_day INTEGER;

-- ============================================================
-- 016: ai_tool_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  tool_name text NOT NULL,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  result_json jsonb,
  receipt_json jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_at timestamp with time zone
);

ALTER TABLE public.ai_tool_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tool runs" ON public.ai_tool_runs;
CREATE POLICY "Users can view their own tool runs"
  ON public.ai_tool_runs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tool runs" ON public.ai_tool_runs;
CREATE POLICY "Users can insert their own tool runs"
  ON public.ai_tool_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tool runs" ON public.ai_tool_runs;
CREATE POLICY "Users can update their own tool runs"
  ON public.ai_tool_runs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_thread ON public.ai_tool_runs(user_id, thread_id);

-- ============================================================
-- 017: AI behavior settings
-- ============================================================
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS council_mode TEXT NOT NULL DEFAULT 'cheap',
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_council_mode_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_council_mode_check
  CHECK (council_mode IN ('cheap', 'best'));

-- ============================================================
-- 018: memory_facts
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_facts_unique_active
    ON public.memory_facts (user_id, lower(fact))
    WHERE is_archived = FALSE;

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
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 019: thread_summaries
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_summaries_user_thread
    ON public.thread_summaries (user_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_thread_summaries_embedding
    ON public.thread_summaries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

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
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 020: user_profile
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profile;
CREATE POLICY "Users can view their own profile"
    ON public.user_profile FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profile;
CREATE POLICY "Users can insert their own profile"
    ON public.user_profile FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profile;
CREATE POLICY "Users can update their own profile"
    ON public.user_profile FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profile;
CREATE POLICY "Users can delete their own profile"
    ON public.user_profile FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_user_profile_updated_at ON public.user_profile;
CREATE TRIGGER trigger_update_user_profile_updated_at
BEFORE UPDATE ON public.user_profile
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 021: persisted threads and messages
-- ============================================================
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
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.thread_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL DEFAULT '',
    attachments JSONB,
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

CREATE OR REPLACE FUNCTION public.touch_thread_last_message_at()
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
FOR EACH ROW EXECUTE FUNCTION public.touch_thread_last_message_at();

-- ============================================================
-- 022: goal operating system foundation
-- ============================================================
ALTER TABLE public.smart_goals
  ADD COLUMN IF NOT EXISTS objective_metric TEXT,
  ADD COLUMN IF NOT EXISTS target_value NUMERIC,
  ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS starts_on DATE,
  ADD COLUMN IF NOT EXISTS due_on DATE,
  ADD COLUMN IF NOT EXISTS success_criteria TEXT;

CREATE INDEX IF NOT EXISTS idx_smart_goals_user_timeframe
  ON public.smart_goals(user_id, timeframe, status);

ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'goal_plan',
  ADD COLUMN IF NOT EXISTS problem_statement TEXT,
  ADD COLUMN IF NOT EXISTS review_date DATE,
  ADD COLUMN IF NOT EXISTS success_criteria TEXT,
  ADD COLUMN IF NOT EXISTS priority_label public.task_category DEFAULT 'negotiable',
  ADD COLUMN IF NOT EXISTS linked_goal_ids UUID[] DEFAULT ARRAY[]::UUID[];

ALTER TABLE public.action_plans
  DROP CONSTRAINT IF EXISTS action_plans_plan_type_check;

ALTER TABLE public.action_plans
  ADD CONSTRAINT action_plans_plan_type_check
  CHECK (plan_type IN ('goal_plan', 'short_term_problem'));

CREATE INDEX IF NOT EXISTS idx_action_plans_user_type
  ON public.action_plans(user_id, plan_type, status);
CREATE INDEX IF NOT EXISTS idx_action_plans_user_review
  ON public.action_plans(user_id, review_date);

CREATE TABLE IF NOT EXISTS public.action_plan_goal_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.smart_goals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, action_plan_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_action_plan_goal_links_plan
  ON public.action_plan_goal_links(user_id, action_plan_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_goal_links_goal
  ON public.action_plan_goal_links(user_id, goal_id);

ALTER TABLE public.action_plan_goal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own action plan goal links" ON public.action_plan_goal_links;
CREATE POLICY "Users can view their own action plan goal links"
  ON public.action_plan_goal_links FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own action plan goal links" ON public.action_plan_goal_links;
CREATE POLICY "Users can insert their own action plan goal links"
  ON public.action_plan_goal_links FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own action plan goal links" ON public.action_plan_goal_links;
CREATE POLICY "Users can update their own action plan goal links"
  ON public.action_plan_goal_links FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own action plan goal links" ON public.action_plan_goal_links;
CREATE POLICY "Users can delete their own action plan goal links"
  ON public.action_plan_goal_links FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'microactivity',
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS outcome_reason TEXT,
  ADD COLUMN IF NOT EXISTS moved_to_task_id UUID REFERENCES public.microactivities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority_source TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS priority_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_time_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.microactivities
  DROP CONSTRAINT IF EXISTS microactivities_source_type_check;
ALTER TABLE public.microactivities
  ADD CONSTRAINT microactivities_source_type_check
  CHECK (source_type IN ('microactivity', 'calendar_event', 'goal_task', 'action_plan_task', 'manual'));

ALTER TABLE public.microactivities
  DROP CONSTRAINT IF EXISTS microactivities_outcome_check;
ALTER TABLE public.microactivities
  ADD CONSTRAINT microactivities_outcome_check
  CHECK (outcome IN ('pending', 'completed', 'skipped', 'moved', 'incomplete', 'blocked', 'deferred'));

ALTER TABLE public.microactivities
  DROP CONSTRAINT IF EXISTS microactivities_priority_source_check;
ALTER TABLE public.microactivities
  ADD CONSTRAINT microactivities_priority_source_check
  CHECK (priority_source IN ('user', 'balys', 'system'));

UPDATE public.microactivities
SET source_id = id::text
WHERE source_id IS NULL;

UPDATE public.microactivities
SET duration_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (end_at - start_at)) / 60.0)::INTEGER)
WHERE duration_minutes IS NULL
  AND start_at IS NOT NULL
  AND end_at IS NOT NULL;

UPDATE public.microactivities
SET is_time_blocked = true
WHERE duration_minutes >= 5;

UPDATE public.microactivities
SET outcome = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'skipped' THEN 'skipped'
  ELSE 'pending'
END
WHERE outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_microactivities_user_plan_day
  ON public.microactivities(user_id, action_plan_id, plan_day);
CREATE INDEX IF NOT EXISTS idx_microactivities_user_goal_date
  ON public.microactivities(user_id, linked_goal_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_microactivities_user_outcome_date
  ON public.microactivities(user_id, outcome, scheduled_date);

-- ============================================================
-- 023: Kill microactivity as a product concept
-- ============================================================
ALTER TABLE public.microactivities
  ALTER COLUMN source_type SET DEFAULT 'manual';

UPDATE public.microactivities
SET source_type = CASE
  WHEN action_plan_id IS NOT NULL THEN 'action_plan_task'
  WHEN linked_goal_id IS NOT NULL THEN 'goal_task'
  ELSE 'manual'
END
WHERE source_type = 'microactivity';

ALTER TABLE public.microactivities
  DROP CONSTRAINT IF EXISTS microactivities_source_type_check;

ALTER TABLE public.microactivities
  ADD CONSTRAINT microactivities_source_type_check
  CHECK (source_type IN ('calendar_event', 'goal_task', 'action_plan_task', 'manual'));
