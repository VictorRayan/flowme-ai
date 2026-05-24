-- 032_web_push_subscriptions.sql
-- Stores Web Push subscriptions for users that opted in to push briefings.

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user
    ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_push_owner_all ON public.web_push_subscriptions;
CREATE POLICY web_push_owner_all
    ON public.web_push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
