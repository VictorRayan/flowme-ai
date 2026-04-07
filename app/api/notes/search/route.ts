import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// GET /api/notes/search?q=... — full-text search over notes for the command palette
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  let query = supabase
    .from('notes')
    .select('id, title, note_date, note_type, content_text')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  if (q) {
    query = query.or(`title.ilike.%${q}%,content_text.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json(data || []);
}
