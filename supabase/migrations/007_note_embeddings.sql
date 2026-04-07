-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding columns to notes
alter table public.notes
  add column if not exists embedding vector(1536),
  add column if not exists embedding_updated_at timestamptz;

-- Index for fast cosine similarity search
create index if not exists idx_notes_embedding
  on public.notes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
