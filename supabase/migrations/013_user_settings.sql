-- ============================================================
-- Migration: 013_user_settings
-- Description: User settings table for rhythms and preferences.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    morning_rhythm_time TIME,
    evening_rhythm_time TIME,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" 
    ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
    ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
    ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update rhythm logs to ensure council_feedback can handle large payloads
ALTER TABLE public.rhythm_logs
ALTER COLUMN council_feedback TYPE JSONB USING council_feedback::JSONB;
