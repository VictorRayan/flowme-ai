-- 035_event_only_action_plan_metadata.sql
-- Remove product-facing priority/category labels from action plans and plan tasks.
-- New execution items are calendar events; legacy labels are normalized to event.

ALTER TABLE public.action_plans
  ALTER COLUMN priority_label DROP DEFAULT;

ALTER TABLE public.action_plans
  ALTER COLUMN priority_label TYPE TEXT USING 'event';

ALTER TABLE public.action_plans
  ALTER COLUMN priority_label SET DEFAULT 'event';

UPDATE public.action_plans
SET priority_label = 'event'
WHERE priority_label IS DISTINCT FROM 'event';

ALTER TABLE public.action_plan_tasks
  DROP CONSTRAINT IF EXISTS action_plan_tasks_category_check;

UPDATE public.action_plan_tasks
SET category = 'event'
WHERE category IS DISTINCT FROM 'event';

ALTER TABLE public.action_plan_tasks
  ALTER COLUMN category SET DEFAULT 'event',
  ADD CONSTRAINT action_plan_tasks_category_check CHECK (category = 'event');

NOTIFY pgrst, 'reload schema';
