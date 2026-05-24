-- 027_thread_messages_transcript_thinking.sql
-- Migration: Add transcript and thinking columns to thread_messages.
-- Why: 021_threads_persisted.sql declared these columns inside a
-- CREATE TABLE IF NOT EXISTS, so installs where the table already existed
-- never received the new columns. Without `thinking`, server-side persisted
-- tool receipts are silently dropped (PGRST204 fallback in
-- lib/ai/threads.ts:persistMessage), which breaks connector follow-ups.

ALTER TABLE public.thread_messages
  ADD COLUMN IF NOT EXISTS selected_action JSONB,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS thinking JSONB;

NOTIFY pgrst, 'reload schema';
