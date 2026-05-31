import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { uploadToR2, deleteFromR2 } from '@/lib/r2/storage';
import { voiceProfileKey } from '@/lib/meetings/voice-profiles-r2-keys';
import { extForMimeType, isAllowedAudioMimeType } from '@/lib/meetings/r2-keys';

const MAX_REFERENCE_BYTES = 5 * 1024 * 1024; // 5 MB — keep clips short

// GET /api/people/[id]/voice-profile — returns whether a profile exists for this person
// POST /api/people/[id]/voice-profile — multipart form with `file` (5-30s reference clip)
// DELETE /api/people/[id]/voice-profile — remove the profile + R2 object
//
// All three require `voice_profiles_enabled = true` on user_profile.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id: personId } = await params;

  await assertOwnsPerson(supabase, user.id, personId);

  const { data: profile } = await supabase
    .from('voice_profiles')
    .select('id, duration_seconds, status, created_at')
    .eq('user_id', user.id)
    .eq('person_id', personId)
    .eq('status', 'active')
    .maybeSingle();

  return apiSuccess({ profile: profile || null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id: personId } = await params;

  // Gate by opt-in.
  const { data: settings } = await supabase
    .from('user_profile')
    .select('voice_profiles_enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!settings?.voice_profiles_enabled) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'voice_profiles_not_enabled', 403);
  }

  await assertOwnsPerson(supabase, user.id, personId);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError(ErrorCode.VALIDATION_ERROR, 'form data required');

  const file = form.get('file');
  if (!(file instanceof Blob)) return apiError(ErrorCode.VALIDATION_ERROR, 'file required');
  if (file.size === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'empty file');
  if (file.size > MAX_REFERENCE_BYTES) return apiError(ErrorCode.VALIDATION_ERROR, 'reference too large');

  const mimeType = String(form.get('mime_type') || file.type || 'audio/webm');
  if (!isAllowedAudioMimeType(mimeType)) return apiError(ErrorCode.VALIDATION_ERROR, `unsupported mime: ${mimeType}`);

  const duration = Math.max(0, Math.floor(Number(form.get('duration_seconds')) || 0));

  const key = voiceProfileKey(user.id, personId, extForMimeType(mimeType));
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await uploadToR2({ key, body: buf, contentType: mimeType });
  } catch (err) {
    return apiError(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : 'r2_upload_failed', 500);
  }

  const { data: profile, error: upsertError } = await supabase
    .from('voice_profiles')
    .upsert({
      user_id: user.id,
      person_id: personId,
      reference_audio_r2_key: key,
      reference_mime_type: mimeType,
      duration_seconds: duration,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,person_id' })
    .select('id, duration_seconds, status, created_at')
    .single();
  if (upsertError) return apiError(ErrorCode.SUPABASE_ERROR, upsertError.message, 500);

  return apiSuccess({ profile });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id: personId } = await params;
  await assertOwnsPerson(supabase, user.id, personId);

  const { data: profile } = await supabase
    .from('voice_profiles')
    .select('id, reference_audio_r2_key')
    .eq('user_id', user.id)
    .eq('person_id', personId)
    .maybeSingle();
  if (!profile) return apiSuccess({ deleted: false });

  await supabase.from('voice_profiles').delete().eq('id', profile.id);
  try { await deleteFromR2(profile.reference_audio_r2_key); } catch {}
  return apiSuccess({ deleted: true });
}

async function assertOwnsPerson(supabase: any, userId: string, personId: string): Promise<void> {
  const { data: person } = await supabase
    .from('people')
    .select('id, user_id')
    .eq('id', personId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!person) throw new Error('person not found');
}
