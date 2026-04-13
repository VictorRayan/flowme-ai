-- ============================================================
-- Migration: 012_smart_goals_and_rhythm
-- Description: Foundation for SMART Goals, Rhythm Tracking, 
-- and the Balys AI Council.
-- ============================================================

-- 1. SMART Goals
CREATE TYPE public.goal_status AS ENUM ('not_started', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.goal_timeframe AS ENUM ('yearly', 'monthly', 'weekly');

CREATE TABLE IF NOT EXISTS public.smart_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    timeframe public.goal_timeframe NOT NULL,
    parent_goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
    status public.goal_status DEFAULT 'not_started',
    target_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure hierarchy validity (e.g., Weekly can belong to Monthly)
    CONSTRAINT parent_goal_differs CHECK (id != parent_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_goals_user ON public.smart_goals(user_id);
ALTER TABLE public.smart_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smart goals" ON public.smart_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own smart goals" ON public.smart_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own smart goals" ON public.smart_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own smart goals" ON public.smart_goals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_smart_goals_updated_at
BEFORE UPDATE ON public.smart_goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2. Enhance microactivities
CREATE TYPE public.task_category AS ENUM ('non_negotiable', 'negotiable', 'routine');
CREATE TYPE public.task_status AS ENUM ('pending', 'completed', 'skipped');

ALTER TABLE public.microactivities
    ADD COLUMN IF NOT EXISTS category public.task_category DEFAULT 'negotiable',
    ADD COLUMN IF NOT EXISTS status public.task_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES public.smart_goals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Populate scheduled_date from start_at for existing rows
UPDATE public.microactivities SET scheduled_date = start_at::DATE WHERE scheduled_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_microact_user_date ON public.microactivities(user_id, scheduled_date);


-- 3. Rhythm Logs (Daily Briefing & Balys Council)
CREATE TABLE IF NOT EXISTS public.rhythm_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    flow_score INTEGER CHECK (flow_score >= 0 AND flow_score <= 100),
    briefing_text TEXT,
    briefing_audio_url TEXT,
    council_feedback JSONB DEFAULT '{}', -- Stores the 13 agent responses + Balys consensus
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_rhythm_logs_user_date ON public.rhythm_logs(user_id, target_date);
ALTER TABLE public.rhythm_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rhythm logs" ON public.rhythm_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own rhythm logs" ON public.rhythm_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rhythm logs" ON public.rhythm_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_rhythm_logs_updated_at
BEFORE UPDATE ON public.rhythm_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4. User Streaks
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_flow_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
-- Usually system/functions update streaks, but allowing user update for now
CREATE POLICY "Users can update their own streaks" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own streaks" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trigger_update_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
