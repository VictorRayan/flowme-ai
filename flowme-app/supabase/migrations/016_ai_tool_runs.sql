-- Migration: 016_ai_tool_runs.sql
-- Description: Creates the ai_tool_runs table to track agent tool operations and receipts.

CREATE TABLE ai_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  tool_name text NOT NULL,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  result_json jsonb,
  receipt_json jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE ai_tool_runs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tool runs
CREATE POLICY "Users can view their own tool runs"
  ON ai_tool_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role / internal API can insert tool runs (since agents run backend-side)
-- But we allow users to insert via UI if necessary, though it's usually API creating it
CREATE POLICY "Users can insert their own tool runs"
  ON ai_tool_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tool runs"
  ON ai_tool_runs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create an index for faster lookups by thread
CREATE INDEX idx_ai_tool_runs_thread ON ai_tool_runs(user_id, thread_id);
