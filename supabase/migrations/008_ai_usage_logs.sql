-- Migration: 008_ai_usage_logs
-- Description: Track AI token and cost usage per user/account/model

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_account_id uuid null references public.linked_accounts(id) on delete set null,
  feature text not null check (feature in ('chat', 'transcribe')),
  provider text not null check (provider in ('openai', 'gemini')),
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_user_created_at
  on public.ai_usage_logs(user_id, created_at desc);

create index if not exists idx_ai_usage_logs_user_model
  on public.ai_usage_logs(user_id, model);

create index if not exists idx_ai_usage_logs_linked_account
  on public.ai_usage_logs(linked_account_id);

alter table public.ai_usage_logs enable row level security;

create policy "Users can view their own ai usage logs"
  on public.ai_usage_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ai usage logs"
  on public.ai_usage_logs for insert
  with check (auth.uid() = user_id);

