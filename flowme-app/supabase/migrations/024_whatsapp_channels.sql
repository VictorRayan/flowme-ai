-- ============================================================
-- Migration: 024_whatsapp_channels
-- Description: WhatsApp channel registration per user.
--   One row per user. Phone stored in E.164 format.
--   Status: pending_verification → active | failed
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_verification',
  verification_code TEXT,
  code_expires_at TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT whatsapp_channels_status_check
    CHECK (status IN ('pending_verification', 'active', 'failed')),
  CONSTRAINT whatsapp_channels_phone_unique UNIQUE (phone),
  CONSTRAINT whatsapp_channels_user_unique  UNIQUE (user_id)
);

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.whatsapp_channels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS whatsapp_channels_phone_idx ON public.whatsapp_channels (phone);
CREATE INDEX IF NOT EXISTS whatsapp_channels_user_idx  ON public.whatsapp_channels (user_id);
