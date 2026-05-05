-- Migration: 004_calendar_cache_events
-- Description: Create calendar_cache_events table and RLS policies

CREATE TABLE IF NOT EXISTS public.calendar_cache_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linked_account_id UUID NOT NULL REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
    provider_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    meet_link TEXT,
    participants_json JSONB,
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    
    -- An event ID from Google is unique per account
    UNIQUE(linked_account_id, provider_event_id)
);

-- Index for querying events over a date range for a specific user
CREATE INDEX IF NOT EXISTS idx_calendar_cache_events_user_start
    ON public.calendar_cache_events(user_id, start_at);

-- Enable RLS
ALTER TABLE public.calendar_cache_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own cached events"
    ON public.calendar_cache_events
    USING (auth.uid() = user_id);

-- Trigger for last_synced_at (using updated_at trigger logic)
CREATE OR REPLACE FUNCTION set_last_synced_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_synced_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_cache_events_synced_at
BEFORE UPDATE ON public.calendar_cache_events
FOR EACH ROW
EXECUTE FUNCTION set_last_synced_at();
