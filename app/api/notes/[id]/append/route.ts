import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';

// POST /api/notes/[id]/append
// Body: { html: string }
// Parses the HTML into TipTap JSON nodes and appends them to the existing note content.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;
  const { html } = await request.json();

  if (!html?.trim()) return apiError(ErrorCode.VALIDATION_ERROR, 'html is required');

  // Fetch existing note
  const { data: note, error: fetchErr } = await supabase
    .from('notes')
    .select('content, content_text')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !note) return apiError(ErrorCode.NOT_FOUND, 'Note not found');

  // Parse incoming HTML into TipTap JSON nodes
  const newDoc = generateJSON(`<hr>${html}`, [StarterKit]);
  const newNodes = newDoc.content as object[];

  // Merge with existing content
  const existing = (note.content as { type: string; content?: object[] } | null);
  const existingNodes: object[] = existing?.content ?? [];
  const mergedContent = { type: 'doc', content: [...existingNodes, ...newNodes] };

  // Plain text for embedding/search
  const newText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const combinedText = [note.content_text, newText].filter(Boolean).join('\n\n');

  const { error: updateErr } = await supabase
    .from('notes')
    .update({
      content: mergedContent,
      content_text: combinedText,
      embedding: null,
      embedding_updated_at: null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateErr) return apiError(ErrorCode.INTERNAL_ERROR, updateErr.message);

  return NextResponse.json({ success: true });
}
