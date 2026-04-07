-- Migration: 003_user_google_tokens
-- Description: Create user_google_tokens table for OAuth and RLS policies

CREATE TABLE IF NOT EXISTS public.user_google_tokens (
    linked_account_id UUID PRIMARY KEY REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Policies (Only accessible to server-side using service_role, OR user who owns the linked account)
-- Since tokens are sensitive, we might only want the backend to access them, 
-- but for consistency let's allow the user to manage their own tokens.
CREATE POLICY "Users can manage their own google tokens"
    ON public.user_google_tokens
    USING (
        EXISTS (
            SELECT 1 FROM public.linked_accounts
            WHERE id = user_google_tokens.linked_account_id
            AND user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE TRIGGER trigger_update_user_google_tokens_updated_at
BEFORE UPDATE ON public.user_google_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
