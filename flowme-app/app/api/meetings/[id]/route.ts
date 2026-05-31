import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// GET  /api/meetings/[id] — full detail (recording + speakers + segments + tasks)
// PATCH /api/meetings/[id] — update title/subject/objective
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  const [speakersRes, segmentsRes, tasksRes, correctionsRes] = await Promise.all([
    supabase.from('meeting_speakers').select('id, provider_label, display_label, person_id, identity_status, is_active').eq('meeting_recording_id', id).order('provider_label', { ascending: true }),
    supabase.from('meeting_transcript_segments').select('id, sequence_number, start_seconds, end_seconds, text, meeting_speaker_id').eq('meeting_recording_id', id).order('sequence_number', { ascending: true }),
    supabase.from('meeting_tasks').select('id, description, assignee_person_id, due_at, status').eq('meeting_recording_id', id).order('created_at', { ascending: true }),
    supabase.from('meeting_speaker_corrections').select('id, sequence_number, correction_text, status, created_at').eq('meeting_recording_id', id).order('sequence_number', { ascending: true }),
  ]);

  return apiSuccess({
    meeting,
    speakers: speakersRes.data || [],
    segments: segmentsRes.data || [],
    tasks: tasksRes.data || [],
    corrections: correctionsRes.data || [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.subject === 'string' || body.subject === null) patch.subject = body.subject ? String(body.subject).trim() : null;
  if (typeof body.objective === 'string' || body.objective === null) patch.objective = body.objective ? String(body.objective).trim() : null;
  if (typeof body.duration_seconds === 'number' && Number.isFinite(body.duration_seconds)) patch.duration_seconds = Math.max(0, Math.floor(body.duration_seconds));

  if (Object.keys(patch).length === 1) return apiError(ErrorCode.VALIDATION_ERROR, 'no fields to update');

  const { error } = await supabase
    .from('meeting_recordings')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
  return apiSuccess({ updated: true });
}
