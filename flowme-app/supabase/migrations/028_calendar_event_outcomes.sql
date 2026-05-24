-- 028_calendar_event_outcomes.sql
-- Track per-user completion state for Google Calendar events without
-- mutating the upstream calendar. The Today view reads this table to
-- hydrate the `outcome` field for each event surfaced from Google.

CREATE TABLE IF NOT EXISTS public.calendar_event_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    linked_account_id UUID,
    outcome TEXT NOT NULL CHECK (outcome IN ('pending','completed','skipped','blocked','moved','incomplete','deferred')),
    outcome_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_outcomes_user
    ON public.calendar_event_outcomes (user_id, event_id);

ALTER TABLE public.calendar_event_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_event_outcomes_owner_all ON public.calendar_event_outcomes;
CREATE POLICY calendar_event_outcomes_owner_all
    ON public.calendar_event_outcomes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
