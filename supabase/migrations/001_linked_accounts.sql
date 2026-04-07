-- Migration: 001_linked_accounts
-- Description: Create linked_accounts table and RLS policies

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

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON public.linked_accounts(user_id);

-- Enable RLS
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own linked accounts"
    ON public.linked_accounts FOR SELECT
    USING (auth.uid() = user_id AND is_deleted = false);

CREATE POLICY "Users can insert their own linked accounts"
    ON public.linked_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linked accounts"
    ON public.linked_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
    ON public.linked_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
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
