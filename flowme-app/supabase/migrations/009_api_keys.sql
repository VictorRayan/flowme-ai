-- ============================================================
-- Migration: 009_api_keys
-- Description: API keys for external AI integrations (Claude, etc.)
-- Each key is scoped to a user and has granular permissions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                          -- e.g. "Claude Desktop", "My GPT"
    key_hash TEXT NOT NULL UNIQUE,               -- SHA-256 hash of the API key
    key_prefix TEXT NOT NULL,                    -- First 8 chars for identification (e.g. "fm_aBcD...")
    scopes TEXT[] NOT NULL DEFAULT '{}',         -- Permissions: calendar.read, calendar.write, notes.read, notes.write, skills.read, skills.write
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,                      -- NULL = never expires
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own api keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own api keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own api keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
