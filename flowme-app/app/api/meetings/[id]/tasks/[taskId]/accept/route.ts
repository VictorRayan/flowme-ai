import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

// POST /api/meetings/[id]/tasks/[taskId]/accept
//   Body for calendar target: { target: 'calendar', linked_account_id, start_at, end_at, description?, participants?: string[] }
//   Body for action plan target: { target: 'action_plan', action_plan_id }
// Marks the meeting task as `accepted` and creates the corresponding artifact.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id: meetingId, taskId } = await params;
  const body = await req.json().catch(() => ({}));
  const target = body?.target;
  if (target !== 'calendar' && target !== 'action_plan') {
    return apiError(ErrorCode.VALIDATION_ERROR, 'target must be calendar or action_plan');
  }

  // Verify ownership of the meeting task.
  const { data: task } = await supabase
    .from('meeting_tasks')
    .select('id, description, due_at, status, meeting_recording_id, meeting_recordings!inner(user_id, title)')
    .eq('id', taskId)
    .eq('meeting_recording_id', meetingId)
    .maybeSingle();
  if (!task || (task as any).meeting_recordings?.user_id !== user.id) {
    return apiError(ErrorCode.NOT_FOUND, 'task not found', 404);
  }

  if (target === 'calendar') {
    const startAt = String(body?.start_at || '').trim();
    const endAt = String(body?.end_at || '').trim();
    const linkedAccountId = String(body?.linked_account_id || '').trim();
    if (!startAt || !endAt) return apiError(ErrorCode.VALIDATION_ERROR, 'start_at and end_at required');
    if (!linkedAccountId) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id required');

    const origin = new URL(req.url).origin;
    const upstream = await fetch(`${origin}/api/calendar/create-event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') || '' },
      body: JSON.stringify({
        linked_account_id: linkedAccountId,
        title: task.description,
        description: `Tarefa da reunião "${(task as any).meeting_recordings.title}"`,
        start_at: startAt,
        end_at: endAt,
        participants: Array.isArray(body?.participants) ? body.participants : [],
        create_meet: false,
      }),
    });
    const upstreamBody = await upstream.json().catch(() => null);
    if (!upstream.ok || upstreamBody?.ok === false) {
      return apiError(ErrorCode.INTERNAL_ERROR, upstreamBody?.error?.message || 'calendar_create_failed', 500);
    }

    await supabase
      .from('meeting_tasks')
      .update({ status: 'accepted', due_at: startAt, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    return apiSuccess({ ok: true, target: 'calendar', event: upstreamBody?.event });
  }

  // action_plan target
  const actionPlanId = String(body?.action_plan_id || '').trim();
  if (!actionPlanId) return apiError(ErrorCode.VALIDATION_ERROR, 'action_plan_id required');

  const { data: plan } = await supabase
    .from('action_plans')
    .select('id, user_id, linked_goal_id')
    .eq('id', actionPlanId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!plan) return apiError(ErrorCode.NOT_FOUND, 'action_plan not found', 404);

  const { data: inserted, error: insertError } = await supabase
    .from('action_plan_tasks')
    .insert({
      user_id: user.id,
      action_plan_id: actionPlanId,
      linked_goal_id: plan.linked_goal_id || null,
      title: task.description,
      description: `Tarefa da reunião "${(task as any).meeting_recordings.title}"`,
      category: 'negotiable',
      status: 'pending',
    })
    .select('id, title')
    .single();
  if (insertError) return apiError(ErrorCode.SUPABASE_ERROR, insertError.message, 500);

  await supabase
    .from('meeting_tasks')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', taskId);

  return apiSuccess({ ok: true, target: 'action_plan', task: inserted });
}
