CREATE TABLE IF NOT EXISTS public.action_plan_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  linked_goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'negotiable' CHECK (category IN ('non_negotiable', 'negotiable', 'routine')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'completed', 'skipped', 'moved', 'incomplete', 'blocked', 'deferred')),
  scheduled_date DATE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  priority SMALLINT DEFAULT 0 CHECK (priority >= 0 AND priority <= 3),
  priority_source TEXT NOT NULL DEFAULT 'balys' CHECK (priority_source IN ('user', 'balys', 'system')),
  priority_reason TEXT,
  source_type TEXT NOT NULL DEFAULT 'action_plan_task' CHECK (source_type IN ('goal_task', 'action_plan_task', 'manual')),
  source_id TEXT,
  plan_day INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_time_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_user_date
  ON public.action_plan_tasks(user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_user_plan_day
  ON public.action_plan_tasks(user_id, action_plan_id, plan_day);

CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_user_goal_date
  ON public.action_plan_tasks(user_id, linked_goal_id, scheduled_date);

ALTER TABLE public.action_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own action plan tasks"
  ON public.action_plan_tasks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own action plan tasks"
  ON public.action_plan_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own action plan tasks"
  ON public.action_plan_tasks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own action plan tasks"
  ON public.action_plan_tasks FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_action_plan_tasks_updated_at ON public.action_plan_tasks;
CREATE TRIGGER trigger_update_action_plan_tasks_updated_at
BEFORE UPDATE ON public.action_plan_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO public.action_plan_tasks (
  user_id,
  action_plan_id,
  linked_goal_id,
  title,
  description,
  category,
  status,
  outcome,
  scheduled_date,
  start_at,
  end_at,
  duration_minutes,
  priority,
  priority_source,
  priority_reason,
  source_type,
  source_id,
  plan_day,
  sort_order,
  is_time_blocked
)
SELECT
  ap.user_id,
  ap.id,
  COALESCE(ap.linked_goal_ids[array_length(ap.linked_goal_ids, 1)], ap.linked_goal_id),
  LEFT(REGEXP_REPLACE(ap.title, '^Action plan:[[:space:]]*', '', 'i'), 160),
  COALESCE(ap.description, ap.success_criteria, 'Task generated from the action plan.'),
  CASE WHEN day_offset = 0 THEN 'non_negotiable' ELSE 'negotiable' END,
  'pending',
  'pending',
  (COALESCE(ap.starts_on, CURRENT_DATE) + day_offset)::date,
  ((COALESCE(ap.starts_on, CURRENT_DATE) + day_offset)::date + TIME '09:00')::timestamptz,
  ((COALESCE(ap.starts_on, CURRENT_DATE) + day_offset)::date + TIME '09:30')::timestamptz,
  30,
  CASE WHEN day_offset = 0 THEN 3 ELSE 2 END,
  'system',
  CASE WHEN day_offset = 0 THEN 'Backfilled first action-plan task.' ELSE 'Backfilled action-plan task.' END,
  'action_plan_task',
  ap.id::text || ':backfill:' || (day_offset + 1)::text,
  day_offset + 1,
  day_offset * 10,
  false
FROM public.action_plans ap
CROSS JOIN LATERAL generate_series(0, GREATEST(0, LEAST(COALESCE(ap.duration_days, 7), 7) - 1)) AS day_offset
WHERE NOT EXISTS (
  SELECT 1
  FROM public.action_plan_tasks existing
  WHERE existing.action_plan_id = ap.id
);
