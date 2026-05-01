-- Run this entire file in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dqzxnnirorwnypzglsxd/sql/new
--
-- This applies migrations 014 (connectors) and 015 (tasks extensions)
-- that have not yet been applied to the live database.

-- ── 014: Connectors ───────────────────────────────────────────────────────────

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

DO $$ BEGIN
  CREATE POLICY "Users can view their own connectors"
    ON public.connectors FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own connectors"
    ON public.connectors FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own connectors"
    ON public.connectors FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own connectors"
    ON public.connectors FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 015: Tasks extensions ─────────────────────────────────────────────────────

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

DO $$ BEGIN
  CREATE POLICY "Users can view their own action plans"
    ON public.action_plans FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own action plans"
    ON public.action_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own action plans"
    ON public.action_plans FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own action plans"
    ON public.action_plans FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_day INTEGER;
