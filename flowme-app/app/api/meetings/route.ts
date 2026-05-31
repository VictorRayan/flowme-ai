import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// POST /api/meetings — create a meeting after consent. Body: { title, subject?, objective?, capturedSources?: string[] }
// GET  /api/meetings — list recent meetings for the user
export async function POST(req: NextRequest) {
  const { supabase, user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || '').trim();
  if (!title || title.length < 2) return apiError(ErrorCode.VALIDATION_ERROR, 'title is required');
  if (body?.consent !== true) return apiError(ErrorCode.VALIDATION_ERROR, 'consent_required');

  const capturedSources: string[] = Array.isArray(body?.capturedSources)
    ? body.capturedSources.filter((s: unknown) => s === 'microphone' || s === 'system_audio')
    : ['microphone'];

  const participantsHint: string[] = Array.isArray(body?.participantsHint)
    ? body.participantsHint
        .map((p: unknown) => typeof p === 'string' ? p.trim() : '')
        .filter((p: string) => p.length > 0 && p.length <= 80)
        .slice(0, 20)
    : [];

  const initialSummary: Record<string, unknown> = participantsHint.length > 0
    ? { participantsHint }
    : {};

  const { data, error } = await supabase
    .from('meeting_recordings')
    .insert({
      user_id: user.id,
      title,
      subject: body?.subject ? String(body.subject).trim() : null,
      objective: body?.objective ? String(body.objective).trim() : null,
      captured_sources: capturedSources,
      summary: initialSummary,
      status: 'recording',
    })
    .select('id, title, status, captured_sources, created_at')
    .single();

  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ meeting: data });
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await requireAuth(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 30, 1), 100);

  const { data, error } = await supabase
    .from('meeting_recordings')
    .select('id, title, subject, status, failed_stage, final_audio_r2_key, duration_seconds, meeting_date, created_at, completed_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ meetings: data || [] });
}
