import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

interface SpeakerPatch {
  id: string;
  person_id?: string | null;
  display_label?: string;
  identity_status?: 'unknown' | 'suggested' | 'confirmed' | 'generic';
}

// PATCH /api/meetings/[id]/speakers — update speaker→person mappings.
// Body: { speakers: [{ id, person_id, display_label, identity_status }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patches: SpeakerPatch[] = Array.isArray(body?.speakers) ? body.speakers : [];
  if (patches.length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'speakers required');

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  for (const p of patches) {
    if (!p.id) continue;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.person_id === null || typeof p.person_id === 'string') update.person_id = p.person_id;
    if (typeof p.display_label === 'string' && p.display_label.trim()) update.display_label = p.display_label.trim();
    if (p.identity_status) update.identity_status = p.identity_status;
    await supabase
      .from('meeting_speakers')
      .update(update)
      .eq('id', p.id)
      .eq('meeting_recording_id', id);
  }

  return apiSuccess({ updated: true });
}
