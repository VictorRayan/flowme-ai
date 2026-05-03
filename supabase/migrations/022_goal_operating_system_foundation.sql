-- Migration: 022_goal_operating_system_foundation
-- Description: Product foundation for goals, action plans, normalized task occurrences, and Today day units.

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
