import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// POST /api/meetings/[id]/finalize — user stopped recording. Move the meeting
// to `processing` so the cron picks it up. Does NOT run the pipeline inline
// (long meetings can't fit in a Next.js function timeout).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, status, duration_seconds')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const { count: chunkCount } = await supabase
    .from('meeting_recording_chunks')
    .select('id', { head: true, count: 'exact' })
    .eq('meeting_recording_id', id)
    .eq('upload_status', 'uploaded');

  if (!chunkCount || chunkCount === 0) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'no chunks uploaded yet', 409);
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    status: 'processing',
    failed_stage: null,
    failure_reason: null,
    updated_at: new Date().toISOString(),
  };
  if (typeof body?.duration_seconds === 'number' && Number.isFinite(body.duration_seconds)) {
    patch.duration_seconds = Math.max(0, Math.floor(body.duration_seconds));
  }
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim();

  const { error } = await supabase
    .from('meeting_recordings')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ queued: true });
}
