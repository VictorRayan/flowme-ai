import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// PATCH /api/meetings/[id]/tasks — accept/dismiss extracted tasks.
// Body: { tasks: [{ id, status: 'accepted'|'dismissed', assignee_person_id?, due_at? }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patches: any[] = Array.isArray(body?.tasks) ? body.tasks : [];
  if (patches.length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'tasks required');

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!meeting) return apiError(ErrorCode.NOT_FOUND, 'meeting not found', 404);

  for (const t of patches) {
    if (!t?.id) continue;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (t.status === 'accepted' || t.status === 'dismissed' || t.status === 'suggested') update.status = t.status;
    if (t.assignee_person_id === null || typeof t.assignee_person_id === 'string') update.assignee_person_id = t.assignee_person_id;
    if (t.due_at === null || typeof t.due_at === 'string') update.due_at = t.due_at;
    await supabase
      .from('meeting_tasks')
      .update(update)
      .eq('id', t.id)
      .eq('meeting_recording_id', id);
  }
  return apiSuccess({ updated: true });
}
