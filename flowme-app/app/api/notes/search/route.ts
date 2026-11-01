import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { ilikeAny } from '@/lib/api/safe-filters';

// GET /api/notes/search?q=... — full-text search over notes for the command palette
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
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
      query = query.or(ilikeAny(['title', 'content_text'], q));
    }

    const { data, error } = await query;
    if (error) {
      console.error('[notes/search] DB error:', error.message);
      return apiError(ErrorCode.INTERNAL_ERROR, error.message);
    }
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notes/search] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
