CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'scheduled',
  channel_preference TEXT NOT NULL DEFAULT 'default',
  source_type TEXT,
  source_provider TEXT,
  source_id TEXT,
  source_title TEXT,
  source_start_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'balys',
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reminders_status_check CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
  CONSTRAINT reminders_channel_preference_check CHECK (channel_preference IN ('default', 'whatsapp', 'instagram', 'push')),
  CONSTRAINT reminders_source_type_check CHECK (source_type IS NULL OR source_type IN ('calendar_event')),
  CONSTRAINT reminders_source_provider_check CHECK (source_provider IS NULL OR source_provider IN ('google_calendar')),
  CONSTRAINT reminders_created_by_check CHECK (created_by IN ('balys', 'user', 'system'))
);

CREATE UNIQUE INDEX IF NOT EXISTS reminders_user_dedupe_idx
  ON public.reminders (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS reminders_user_status_schedule_idx
  ON public.reminders (user_id, status, scheduled_for);

CREATE INDEX IF NOT EXISTS reminders_source_idx
  ON public.reminders (user_id, source_type, source_id);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reminder_deliveries_provider_check CHECK (provider IN ('whatsapp', 'manychat', 'push')),
  CONSTRAINT reminder_deliveries_status_check CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  CONSTRAINT reminder_deliveries_attempt_check CHECK (attempt > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_deliveries_sent_once_idx
  ON public.reminder_deliveries (reminder_id, provider)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS reminder_deliveries_user_idx
  ON public.reminder_deliveries (user_id, status, scheduled_for);

ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.reminder_deliveries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_default_reminder_channel BOOLEAN NOT NULL DEFAULT TRUE;

