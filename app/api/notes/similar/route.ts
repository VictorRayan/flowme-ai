import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

// POST /api/notes/similar
// Body: { query: string, note_ids: string[], top_k?: number }
// Embeds the query, then finds the most relevant notes from the given IDs using cosine similarity.
// Returns the top_k notes with their content_text ranked by relevance.
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const { query, note_ids, top_k = 3 } = await request.json();

  if (!query || !note_ids?.length) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'query and note_ids are required');
  }

  if (!process.env.OPENAI_API_KEY) {
    return apiError(ErrorCode.INTERNAL_ERROR, 'OpenAI API key not configured');
  }

  // Embed the query
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query.slice(0, 8000),
  });
  const queryEmbedding = embRes.data[0].embedding;

  // Fetch embeddings for the selected notes (only those that have been embedded)
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, note_date, content_text, embedding')
    .in('id', note_ids)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .not('embedding', 'is', null);

  if (!notes?.length) return NextResponse.json({ notes: [] });

  // Compute cosine similarity client-side (vectors are already fetched)
  const scored = notes.map(note => {
    const emb = note.embedding as number[];
    const sim = cosineSimilarity(queryEmbedding, emb);
    return { ...note, similarity: sim };
  });

  // Return top_k most relevant
  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored.slice(0, top_k).map(n => ({
    id: n.id,
    title: n.title,
    note_date: n.note_date,
    content_text: n.content_text,
    similarity: Math.round(n.similarity * 100) / 100,
  }));

  return NextResponse.json({ notes: top });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
