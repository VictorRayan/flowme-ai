import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { uploadToR2 } from '@/lib/r2/storage';
import { meetingCorrectionKey, extForMimeType, isAllowedAudioMimeType } from '@/lib/meetings/r2-keys';

const MAX_CORRECTION_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CORRECTIONS_PER_MEETING = 3;

// GET /api/meetings/[id]/corrections — list prior corrections
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const { data, error } = await supabase
    .from('meeting_speaker_corrections')
    .select('id, sequence_number, correction_text, status, failure_reason, applied_segment_changes, created_at, applied_at')
    .eq('meeting_recording_id', id)
    .order('sequence_number', { ascending: true });
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ corrections: data || [] });
}

// POST /api/meetings/[id]/corrections — multipart form with `file` (correction audio).
// Records the correction in `pending` and queues reanalysis. The cron handles
// transcription of the correction audio and the actual reassignment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const { count } = await supabase
    .from('meeting_speaker_corrections')
    .select('id', { head: true, count: 'exact' })
    .eq('meeting_recording_id', id);
  if ((count || 0) >= MAX_CORRECTIONS_PER_MEETING) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'max corrections reached for this meeting', 409);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return apiError(ErrorCode.VALIDATION_ERROR, 'form data required');

  const file = form.get('file');
  if (!(file instanceof Blob)) return apiError(ErrorCode.VALIDATION_ERROR, 'file required');
  if (file.size === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'empty correction');
  if (file.size > MAX_CORRECTION_AUDIO_BYTES) return apiError(ErrorCode.VALIDATION_ERROR, 'correction too large');

  const mimeType = String(form.get('mime_type') || file.type || 'audio/webm');
  if (!isAllowedAudioMimeType(mimeType)) return apiError(ErrorCode.VALIDATION_ERROR, `unsupported mime: ${mimeType}`);

  const sequenceNumber = (count || 0) + 1;
  const key = meetingCorrectionKey(id, sequenceNumber, extForMimeType(mimeType));
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await uploadToR2({ key, body: buf, contentType: mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'r2_upload_failed';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }

  const { data: correction, error } = await supabase
    .from('meeting_speaker_corrections')
    .insert({
      meeting_recording_id: id,
      sequence_number: sequenceNumber,
      correction_audio_r2_key: key,
      status: 'pending',
    })
    .select('id, sequence_number, status')
    .single();
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

  await supabase
    .from('meeting_recordings')
    .update({ status: 'reanalyzing', updated_at: new Date().toISOString() })
    .eq('id', id);

  return apiSuccess({ correction });
}
