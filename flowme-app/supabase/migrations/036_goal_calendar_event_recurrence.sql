-- 036_goal_calendar_event_recurrence.sql
-- Store the RRULE recurrence of each goal/action-plan calendar event so Balys
-- can faithfully reschedule the cadence and restore deleted recurring series.

ALTER TABLE public.goal_calendar_events
    ADD COLUMN IF NOT EXISTS recurrence TEXT[];

NOTIFY pgrst, 'reload schema';
