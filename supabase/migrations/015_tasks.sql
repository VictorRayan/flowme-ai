-- Migration: 015_tasks
-- Description: Extend microactivities for full task management.
-- Adds priority, notes, and recurrence. Also creates the action_plans table.

-- Add extra columns to microactivities (tasks)
ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS priority SMALLINT DEFAULT 0 CHECK (priority >= 0 AND priority <= 3),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- RRULE string e.g. 'FREQ=DAILY'

-- Action plans: a named sequence of tasks tied to a goal
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

CREATE POLICY "Users can view their own action plans"
  ON public.action_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own action plans"
  ON public.action_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own action plans"
  ON public.action_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own action plans"
  ON public.action_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Link tasks to action plans
ALTER TABLE public.microactivities
  ADD COLUMN IF NOT EXISTS action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_day INTEGER; -- which day within the plan (1-indexed)
