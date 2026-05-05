-- 023: Kill microactivity as a product concept.
-- The physical table remains public.microactivities as legacy storage for Flowme events.

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
