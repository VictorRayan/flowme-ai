import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { finalizeAndSaveMeeting } from '@/lib/meetings/finalize';

// POST /api/meetings/[id]/finalize-save — Stage 6.
// Body: { speakerAssignments: [{ speakerId, providerLabel, displayLabel, personId|null }], timezone? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const assignments = Array.isArray(body?.speakerAssignments) ? body.speakerAssignments : [];
  if (assignments.length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'speakerAssignments required');

  const timezone = String(body?.timezone || 'UTC');
  const todayIso = computeTodayIso(timezone);

  try {
    const result = await finalizeAndSaveMeeting({
      supabase,
      userId: user.id,
      meetingId: id,
      speakerAssignments: assignments,
      todayIso,
    });
    if (!result.ok) {
      // Stage 6 failed — mark awaiting_retry so the finalization screen shows the failure state.
      await supabase
        .from('meeting_recordings')
        .update({ status: 'awaiting_retry', failed_stage: 'save', failure_reason: result.error })
        .eq('id', id)
        .eq('user_id', user.id);
      return apiError(ErrorCode.INTERNAL_ERROR, result.error || 'save_failed', 500);
    }
    return apiSuccess({
      note_id: result.meetingNoteId,
      daily_briefing_note_id: result.dailyBriefingNoteId,
      mentioned_person_ids: result.mentionedPersonIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save_failed';
    await supabase
      .from('meeting_recordings')
      .update({ status: 'awaiting_retry', failed_stage: 'save', failure_reason: message })
      .eq('id', id)
      .eq('user_id', user.id);
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

function computeTodayIso(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
