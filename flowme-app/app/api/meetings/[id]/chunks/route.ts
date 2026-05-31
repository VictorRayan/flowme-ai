import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { uploadToR2 } from '@/lib/r2/storage';
import { meetingChunkKey, extForMimeType, isAllowedAudioMimeType } from '@/lib/meetings/r2-keys';

const MAX_CHUNK_BYTES = 50 * 1024 * 1024; // 50 MB per chunk

// POST /api/meetings/[id]/chunks — multipart form with `file`, `sequence_number`, `duration_seconds`
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  // Verify ownership
  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError(ErrorCode.VALIDATION_ERROR, 'form data required');

  const file = form.get('file');
  if (!(file instanceof Blob)) return apiError(ErrorCode.VALIDATION_ERROR, 'file required');
  if (file.size > MAX_CHUNK_BYTES) return apiError(ErrorCode.VALIDATION_ERROR, 'chunk too large');
  if (file.size === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'empty chunk');

  const sequenceRaw = form.get('sequence_number');
  const sequenceNumber = Number(sequenceRaw);
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 0) return apiError(ErrorCode.VALIDATION_ERROR, 'sequence_number must be a non-negative integer');

  const durationRaw = form.get('duration_seconds');
  const durationSeconds = Math.max(0, Math.floor(Number(durationRaw) || 0));

  const mimeType = String(form.get('mime_type') || file.type || 'audio/webm');
  if (!isAllowedAudioMimeType(mimeType)) return apiError(ErrorCode.VALIDATION_ERROR, `unsupported mime: ${mimeType}`);

  const key = meetingChunkKey(id, sequenceNumber, extForMimeType(mimeType));
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToR2({ key, body: buf, contentType: mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'r2_upload_failed';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }

  const { error: upsertError } = await supabase
    .from('meeting_recording_chunks')
    .upsert({
      meeting_recording_id: id,
      sequence_number: sequenceNumber,
      r2_key: key,
      mime_type: mimeType,
      duration_seconds: durationSeconds,
      size_bytes: buf.byteLength,
      upload_status: 'uploaded',
    }, { onConflict: 'meeting_recording_id,sequence_number' });

  if (upsertError) return apiError(ErrorCode.SUPABASE_ERROR, upsertError.message, 500);
  return apiSuccess({ uploaded: true, sequence_number: sequenceNumber, r2_key: key });
}
