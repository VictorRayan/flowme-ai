-- Migration: 014_connectors
-- Description: External data source connectors (Google Docs, Sheets, Gmail, etc.)

CREATE TYPE public.connector_type AS ENUM (
  'gmail',
  'google_docs',
  'google_sheets',
  'google_drive'
);

CREATE TABLE IF NOT EXISTS public.connectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.connector_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- OAuth token stored via user_google_tokens join (reuses same Google OAuth infra)
  -- Extra config per connector type (e.g. sheet_id, folder_id)
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connectors_user ON public.connectors(user_id);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connectors"
  ON public.connectors FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connectors"
  ON public.connectors FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connectors"
  ON public.connectors FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connectors"
  ON public.connectors FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_connectors_updated_at
BEFORE UPDATE ON public.connectors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
