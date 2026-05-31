import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { getPresignedDownloadUrl } from '@/lib/r2/storage';

// GET /api/meetings/[id]/audio — short-lived signed URL for the durable audio
// (final_audio_r2_key). Used by the finalization screen / meeting note player.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, final_audio_r2_key, final_audio_mime_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);
  if (!meeting.final_audio_r2_key) return apiError(ErrorCode.NOT_FOUND, 'audio not yet assembled', 404);

  try {
    const url = await getPresignedDownloadUrl(meeting.final_audio_r2_key, 60 * 30);
    return apiSuccess({ url, mime_type: meeting.final_audio_mime_type });
  } catch (err) {
    return apiError(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : 'sign_failed', 500);
  }
}
