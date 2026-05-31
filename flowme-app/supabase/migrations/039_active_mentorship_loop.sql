-- 039_active_mentorship_loop.sql
-- Adds the execution evidence and ritual notification foundation used by Balys.

CREATE TABLE IF NOT EXISTS public.calendar_event_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linked_account_id UUID NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_title TEXT NOT NULL,
    initial_start_at TIMESTAMPTZ NOT NULL,
    initial_end_at TIMESTAMPTZ,
    current_start_at TIMESTAMPTZ NOT NULL,
    current_end_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, linked_account_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_snapshots_user
    ON public.calendar_event_snapshots (user_id, current_start_at);

ALTER TABLE public.calendar_event_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_event_snapshots_owner_all ON public.calendar_event_snapshots;
CREATE POLICY calendar_event_snapshots_owner_all
    ON public.calendar_event_snapshots
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.calendar_event_reschedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linked_account_id UUID NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_title TEXT NOT NULL,
    initial_start_at TIMESTAMPTZ NOT NULL,
    initial_end_at TIMESTAMPTZ,
    previous_start_at TIMESTAMPTZ NOT NULL,
    previous_end_at TIMESTAMPTZ,
    new_start_at TIMESTAMPTZ NOT NULL,
    new_end_at TIMESTAMPTZ,
    offset_minutes INTEGER NOT NULL,
    total_offset_minutes INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('postponed', 'advanced', 'unchanged')),
    minutes_before_previous_start INTEGER NOT NULL,
    changed_by TEXT NOT NULL CHECK (changed_by IN ('user_ui', 'balys', 'batch_replan', 'google_external', 'system')),
    source_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_reschedules_user
    ON public.calendar_event_reschedules (user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_event_reschedules_event
    ON public.calendar_event_reschedules (user_id, linked_account_id, provider_event_id, changed_at DESC);

ALTER TABLE public.calendar_event_reschedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_event_reschedules_owner_all ON public.calendar_event_reschedules;
CREATE POLICY calendar_event_reschedules_owner_all
    ON public.calendar_event_reschedules
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.calendar_event_outcomes
    DROP CONSTRAINT IF EXISTS calendar_event_outcomes_outcome_check;

ALTER TABLE public.calendar_event_outcomes
    ADD CONSTRAINT calendar_event_outcomes_outcome_check
    CHECK (outcome IN ('pending','completed','skipped','not_done','blocked','moved','incomplete','deferred')),
    ADD COLUMN IF NOT EXISTS reason_code TEXT,
    ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS answer_source TEXT;

ALTER TABLE public.calendar_event_outcomes
    DROP CONSTRAINT IF EXISTS calendar_event_outcomes_answer_source_check;

ALTER TABLE public.calendar_event_outcomes
    ADD CONSTRAINT calendar_event_outcomes_answer_source_check
    CHECK (answer_source IS NULL OR answer_source IN ('today_ui', 'push', 'whatsapp', 'balys'));

ALTER TABLE public.user_profile
    ADD COLUMN IF NOT EXISTS daily_briefing_note_prompt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS daily_briefing_note_time TEXT,
    ADD COLUMN IF NOT EXISTS daily_briefing_note_channels TEXT[] NOT NULL DEFAULT ARRAY['push'],
    ADD COLUMN IF NOT EXISTS weekly_review_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS weekly_review_weekday INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS weekly_review_time TEXT NOT NULL DEFAULT '18:00',
    ADD COLUMN IF NOT EXISTS weekly_review_channels TEXT[] NOT NULL DEFAULT ARRAY['push'],
    ADD COLUMN IF NOT EXISTS post_event_checkin_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS post_event_checkin_channels TEXT[] NOT NULL DEFAULT ARRAY['push', 'whatsapp'],
    ADD COLUMN IF NOT EXISTS mirror_calendar_reminders_to_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notification_language TEXT NOT NULL DEFAULT 'pt';

ALTER TABLE public.user_profile
    DROP CONSTRAINT IF EXISTS user_profile_weekly_review_weekday_check;

ALTER TABLE public.user_profile
    ADD CONSTRAINT user_profile_weekly_review_weekday_check
    CHECK (weekly_review_weekday BETWEEN 0 AND 6);

CREATE TABLE IF NOT EXISTS public.ritual_prompt_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ritual_kind TEXT NOT NULL CHECK (ritual_kind IN ('daily_briefing_note', 'weekly_review')),
    occurrence_key TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('push', 'whatsapp')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, ritual_kind, occurrence_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_ritual_prompt_deliveries_user
    ON public.ritual_prompt_deliveries (user_id, ritual_kind, occurrence_key);

ALTER TABLE public.ritual_prompt_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ritual_prompt_deliveries_owner_all ON public.ritual_prompt_deliveries;
CREATE POLICY ritual_prompt_deliveries_owner_all
    ON public.ritual_prompt_deliveries
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notification_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('today_task')),
    source_key TEXT NOT NULL,
    target_payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, target_kind, source_key)
);

ALTER TABLE public.notification_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_targets_owner_all ON public.notification_targets;
CREATE POLICY notification_targets_owner_all
    ON public.notification_targets
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.event_checkin_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('push', 'whatsapp')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, source_key, channel)
);

ALTER TABLE public.event_checkin_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_checkin_deliveries_owner_all ON public.event_checkin_deliveries;
CREATE POLICY event_checkin_deliveries_owner_all
    ON public.event_checkin_deliveries
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
