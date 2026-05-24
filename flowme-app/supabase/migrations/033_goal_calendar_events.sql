-- 033_goal_calendar_events.sql
-- Link Google Calendar events back to the goal/action-plan occurrence that
-- created them, so deletions can be surfaced to Balys for rescheduling.

CREATE TABLE IF NOT EXISTS public.goal_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linked_account_id UUID NOT NULL,
    provider_event_id TEXT NOT NULL,
    action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE SET NULL,
    goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    plan_day INTEGER,
    sort_order INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted','rescheduled','moved')),
    deletion_source TEXT CHECK (deletion_source IN ('calendar_ui','balys','api','unknown')),
    deletion_note TEXT,
    deleted_at TIMESTAMPTZ,
    rescheduled_provider_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, linked_account_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_calendar_events_user_status
    ON public.goal_calendar_events (user_id, status, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_goal_calendar_events_plan_status
    ON public.goal_calendar_events (user_id, action_plan_id, status, scheduled_date);

ALTER TABLE public.goal_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goal_calendar_events_owner_all ON public.goal_calendar_events;
CREATE POLICY goal_calendar_events_owner_all
    ON public.goal_calendar_events
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
