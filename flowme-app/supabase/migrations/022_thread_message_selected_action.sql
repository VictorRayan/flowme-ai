ALTER TABLE public.thread_messages
ADD COLUMN IF NOT EXISTS selected_action JSONB;
