-- ============================================================
-- Flow Me - Complete Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- 001: Linked Accounts
CREATE TABLE IF NOT EXISTS public.linked_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('work', 'personal')),
    provider TEXT DEFAULT 'google',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON public.linked_accounts(user_id);
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own linked accounts"
    ON public.linked_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linked accounts"
    ON public.linked_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linked accounts"
    ON public.linked_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
    ON public.linked_accounts FOR DELETE
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_linked_accounts_updated_at
BEFORE UPDATE ON public.linked_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 002: Microactivities
CREATE TABLE IF NOT EXISTS public.microactivities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_microactivities_user_id_start_at 
    ON public.microactivities(user_id, start_at);

ALTER TABLE public.microactivities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own microactivities"
    ON public.microactivities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own microactivities"
    ON public.microactivities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own microactivities"
    ON public.microactivities FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own microactivities"
    ON public.microactivities FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_microactivities_updated_at
BEFORE UPDATE ON public.microactivities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 003: User Google Tokens
CREATE TABLE IF NOT EXISTS public.user_google_tokens (
    linked_account_id UUID PRIMARY KEY REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Separate policies for each operation
CREATE POLICY "Users can view their own google tokens"
    ON public.user_google_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.linked_accounts
            WHERE id = user_google_tokens.linked_account_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own google tokens"
    ON public.user_google_tokens FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.linked_accounts
            WHERE id = user_google_tokens.linked_account_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own google tokens"
    ON public.user_google_tokens FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.linked_accounts
            WHERE id = user_google_tokens.linked_account_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own google tokens"
    ON public.user_google_tokens FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.linked_accounts
            WHERE id = user_google_tokens.linked_account_id
            AND user_id = auth.uid()
        )
    );

CREATE TRIGGER trigger_update_user_google_tokens_updated_at
BEFORE UPDATE ON public.user_google_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 004: Calendar Cache Events
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
    UNIQUE(linked_account_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_cache_events_user_start
    ON public.calendar_cache_events(user_id, start_at);

ALTER TABLE public.calendar_cache_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cached events"
    ON public.calendar_cache_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cached events"
    ON public.calendar_cache_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cached events"
    ON public.calendar_cache_events FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cached events"
    ON public.calendar_cache_events FOR DELETE
    USING (auth.uid() = user_id);

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
