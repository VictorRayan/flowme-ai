import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

// POST /api/notes/[id]/embed
// Returns cached embedding if fresh, otherwise generates and caches it.
// Response: { embedding: number[], cached: boolean }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return apiError(ErrorCode.INTERNAL_ERROR, 'OpenAI API key not configured');
  }

  // Fetch note
  const { data: note, error: fetchError } = await supabase
    .from('notes')
    .select('id, title, content_text, note_date, embedding, embedding_updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !note) return apiError(ErrorCode.NOT_FOUND, 'Note not found');

  // Return cached embedding if still valid
  if (note.embedding && note.embedding_updated_at) {
    return NextResponse.json({ embedding: note.embedding, cached: true });
  }

  // Build text to embed: title + date + content
  const parts = [
    note.title,
    note.note_date ? `Date: ${note.note_date}` : '',
    note.content_text || '',
  ].filter(Boolean);
  const text = parts.join('\n').slice(0, 8000); // stay within embedding input limit

  if (!text.trim()) {
    return NextResponse.json({ embedding: null, cached: false });
  }

  // Generate embedding
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  const embedding = response.data[0].embedding;

  // Store in DB
  await supabase
    .from('notes')
    .update({ embedding, embedding_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  return NextResponse.json({ embedding, cached: false });
}
