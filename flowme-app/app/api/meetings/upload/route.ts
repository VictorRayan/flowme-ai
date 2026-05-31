import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { uploadToR2 } from '@/lib/r2/storage';
import { meetingChunkKey, extForMimeType, isAllowedAudioMimeType } from '@/lib/meetings/r2-keys';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

// POST /api/meetings/upload — multipart form { file, title, subject?, objective?, consent: '1' }
// Creates a meeting, treats the upload as sequence_number=0 chunk, and queues
// processing in one shot. Used by the "Subir áudio existente" entry point.
export async function POST(req: NextRequest) {
  const { supabase, user } = await requireAuth(req);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError(ErrorCode.VALIDATION_ERROR, 'form data required');

  const file = form.get('file');
  if (!(file instanceof Blob)) return apiError(ErrorCode.VALIDATION_ERROR, 'file required');
  if (file.size === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'empty file');
  if (file.size > MAX_UPLOAD_BYTES) return apiError(ErrorCode.VALIDATION_ERROR, 'file too large');

  const title = String(form.get('title') || '').trim();
  if (!title || title.length < 2) return apiError(ErrorCode.VALIDATION_ERROR, 'title required');
  const consentValue = String(form.get('consent') || '');
  if (consentValue !== '1' && consentValue !== 'true') {
    return apiError(ErrorCode.VALIDATION_ERROR, 'consent_required');
  }

  const mimeType = String(form.get('mime_type') || file.type || 'audio/webm');
  if (!isAllowedAudioMimeType(mimeType)) return apiError(ErrorCode.VALIDATION_ERROR, `unsupported mime: ${mimeType}`);

  let participantsHint: string[] = [];
  const hintRaw = form.get('participants_hint');
  if (typeof hintRaw === 'string' && hintRaw.length > 0) {
    try {
      const parsed = JSON.parse(hintRaw);
      if (Array.isArray(parsed)) {
        participantsHint = parsed
          .map((p) => typeof p === 'string' ? p.trim() : '')
          .filter((p: string) => p.length > 0 && p.length <= 80)
          .slice(0, 20);
      }
    } catch {}
  }

  // 1) Create the meeting row already in `uploading`.
  const { data: meeting, error: insertError } = await supabase
    .from('meeting_recordings')
    .insert({
      user_id: user.id,
      title,
      subject: form.get('subject') ? String(form.get('subject')).trim() : null,
      objective: form.get('objective') ? String(form.get('objective')).trim() : null,
      status: 'uploading',
      captured_sources: ['uploaded_file'],
      summary: participantsHint.length > 0 ? { participantsHint } : {},
    })
    .select('id, title, status')
    .single();
  if (insertError || !meeting) return apiError(ErrorCode.SUPABASE_ERROR, insertError?.message || 'insert_failed', 500);

  // 2) Upload as a single chunk and let the existing pipeline assemble it.
  const key = meetingChunkKey(meeting.id, 0, extForMimeType(mimeType));
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await uploadToR2({ key, body: buf, contentType: mimeType });
  } catch (err) {
    return apiError(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : 'r2_upload_failed', 500);
  }

  const { error: chunkError } = await supabase
    .from('meeting_recording_chunks')
    .insert({
      meeting_recording_id: meeting.id,
      sequence_number: 0,
      r2_key: key,
      mime_type: mimeType,
      duration_seconds: 0,
      size_bytes: buf.byteLength,
      upload_status: 'uploaded',
    });
  if (chunkError) return apiError(ErrorCode.SUPABASE_ERROR, chunkError.message, 500);

  // 3) Mark ready for the pipeline cron.
  await supabase
    .from('meeting_recordings')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', meeting.id);

  return apiSuccess({ meeting: { ...meeting, status: 'processing' } });
}
