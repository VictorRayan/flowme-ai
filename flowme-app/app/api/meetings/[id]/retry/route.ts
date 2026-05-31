import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// POST /api/meetings/[id]/retry — Re-queue the pipeline starting from
// `failed_stage` (or from the body's explicit `from_stage`).
// Never re-runs Stage 1 if the meeting already has a `final_audio_r2_key`.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, status, failed_stage, final_audio_r2_key')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const body = await req.json().catch(() => ({}));
  const requested = String(body?.from_stage || meeting.failed_stage || 'transcribe');
  const allowed = new Set(['assemble', 'transcribe', 'summarize']);
  let fromStage = allowed.has(requested) ? requested : 'transcribe';

  // If audio is already durably persisted, never re-run Stage 1 — reuse it.
  if (meeting.final_audio_r2_key && fromStage === 'assemble') {
    fromStage = 'transcribe';
  }
  // If audio is NOT persisted, only Stage 1 is meaningful.
  if (!meeting.final_audio_r2_key) {
    fromStage = 'assemble';
  }

  const { error } = await supabase
    .from('meeting_recordings')
    .update({
      status: 'processing',
      failed_stage: null,
      failure_reason: null,
      summary: { retry_from_stage: fromStage } as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ queued: true, from_stage: fromStage });
}
