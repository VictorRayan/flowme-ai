-- 049_mobile_push_tokens.sql
-- Device tokens for native mobile push notifications.

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  provider TEXT NOT NULL CHECK (provider IN ('apns', 'fcm')),
  device_token TEXT NOT NULL,
  device_id TEXT,
  app_version TEXT,
  os_version TEXT,
  locale TEXT,
  timezone TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (platform = 'ios' AND provider = 'apns')
    OR (platform = 'android' AND provider = 'fcm')
  ),
  UNIQUE (user_id, provider, device_token)
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user_enabled
  ON public.mobile_push_tokens (user_id, enabled, provider);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_device_id
  ON public.mobile_push_tokens (user_id, device_id)
  WHERE device_id IS NOT NULL;

ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_push_tokens_owner_all ON public.mobile_push_tokens;
CREATE POLICY mobile_push_tokens_owner_all
  ON public.mobile_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
