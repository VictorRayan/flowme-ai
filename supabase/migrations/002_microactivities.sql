-- Migration: 002_microactivities
-- Description: Create microactivities table and RLS policies

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

-- Index for faster date range queries
CREATE INDEX IF NOT EXISTS idx_microactivities_user_id_start_at 
    ON public.microactivities(user_id, start_at);

-- Enable RLS
ALTER TABLE public.microactivities ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Trigger for updated_at
CREATE TRIGGER trigger_update_microactivities_updated_at
BEFORE UPDATE ON public.microactivities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
