// Stage 6 — commit speaker mappings, write the standalone meeting note,
// append a block to today's daily briefing note, upsert @mentions and add
// compact references to each participant's profile note.
//
// This helper is intentionally small and idempotent: a retry must produce the
// same end state without duplicating any rows.

interface SupabaseLike { from(table: string): any }

export interface FinalizeInput {
  supabase: SupabaseLike;
  userId: string;
  meetingId: string;
  speakerAssignments: Array<{
    speakerId: string;
    providerLabel: string;
    displayLabel: string;
    personId: string | null;
  }>;
  todayIso: string; // YYYY-MM-DD for the user's local date
}

export interface FinalizeResult {
  ok: boolean;
  meetingNoteId: string | null;
  dailyBriefingNoteId: string | null;
  mentionedPersonIds: string[];
  error?: string;
}

export async function finalizeAndSaveMeeting(input: FinalizeInput): Promise<FinalizeResult> {
  const { supabase, userId, meetingId, speakerAssignments, todayIso } = input;

  const { data: meeting } = await supabase
    .from('meeting_recordings')
    .select('id, user_id, title, subject, objective, note_id, daily_briefing_note_id, final_audio_r2_key, summary, status')
    .eq('id', meetingId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!meeting) return { ok: false, meetingNoteId: null, dailyBriefingNoteId: null, mentionedPersonIds: [], error: 'meeting_not_found' };

  // 1) Persist confirmed speaker mappings.
  const confirmedPersonIds = new Set<string>();
  for (const sa of speakerAssignments) {
    const status = sa.personId ? 'confirmed' : 'generic';
    await supabase
      .from('meeting_speakers')
      .update({
        person_id: sa.personId,
        display_label: sa.displayLabel,
        identity_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sa.speakerId)
      .eq('meeting_recording_id', meetingId);
    if (sa.personId) confirmedPersonIds.add(sa.personId);
  }

  // 2) Render the meeting block. We render plain text — the TipTap renderer
  //    on the client converts it to rich content; keeping it textual keeps
  //    this helper simple and easy to test.
  const { data: speakers } = await supabase
    .from('meeting_speakers')
    .select('id, provider_label, display_label, person_id, is_active')
    .eq('meeting_recording_id', meetingId)
    .order('provider_label', { ascending: true });
  const { data: segments } = await supabase
    .from('meeting_transcript_segments')
    .select('sequence_number, start_seconds, end_seconds, text, meeting_speaker_id')
    .eq('meeting_recording_id', meetingId)
    .order('sequence_number', { ascending: true });
  const { data: tasks } = await supabase
    .from('meeting_tasks')
    .select('id, description, assignee_person_id, due_at, status')
    .eq('meeting_recording_id', meetingId)
    .order('created_at', { ascending: true });

  const meetingBlock = renderMeetingBlock({
    title: meeting.title,
    subject: meeting.subject || '',
    objective: meeting.objective || '',
    speakers: (speakers || []) as any[],
    segments: (segments || []) as any[],
    tasks: ((tasks || []) as any[]).filter((t) => t.status !== 'dismissed'),
  });

  // 3) Upsert the standalone meeting note.
  const meetingNoteRow: Record<string, unknown> = {
    user_id: userId,
    title: meeting.title,
    content_text: meetingBlock,
    note_type: 'meeting',
    note_date: todayIso,
  };
  let meetingNoteId: string | null = meeting.note_id;
  if (meetingNoteId) {
    await supabase.from('notes').update({ ...meetingNoteRow, updated_at: new Date().toISOString() }).eq('id', meetingNoteId);
  } else {
    const { data } = await supabase.from('notes').insert(meetingNoteRow).select('id').single();
    meetingNoteId = (data as any)?.id || null;
  }

  // 4) Append a compact block to today's daily briefing note (upsert by date).
  const { data: existingBriefing } = await supabase
    .from('notes')
    .select('id, content_text')
    .eq('user_id', userId)
    .eq('note_type', 'daily_briefing')
    .eq('note_date', todayIso)
    .maybeSingle();

  let dailyBriefingNoteId: string | null = (existingBriefing as any)?.id || null;
  const briefingBlock = `\n\n--- Reunião: ${meeting.title} ---\n${meetingBlock}`;
  if (dailyBriefingNoteId) {
    const existing = String((existingBriefing as any)?.content_text || '');
    // Guard against duplicate appends (idempotency on retry)
    const marker = `--- Reunião: ${meeting.title} ---`;
    if (!existing.includes(marker)) {
      await supabase.from('notes').update({ content_text: existing + briefingBlock, updated_at: new Date().toISOString() }).eq('id', dailyBriefingNoteId);
    }
  } else {
    const { data } = await supabase.from('notes').insert({
      user_id: userId,
      title: `Daily briefing — ${todayIso}`,
      content_text: briefingBlock,
      note_type: 'daily_briefing',
      note_date: todayIso,
    }).select('id').single();
    dailyBriefingNoteId = (data as any)?.id || null;
  }

  // 5) Mentions per confirmed person, idempotently.
  const mentionedIds: string[] = [];
  for (const personId of confirmedPersonIds) {
    for (const noteId of [meetingNoteId, dailyBriefingNoteId].filter(Boolean) as string[]) {
      const { data: existingMention } = await supabase
        .from('note_mentions')
        .select('id')
        .eq('note_id', noteId)
        .eq('person_id', personId)
        .maybeSingle();
      if (!existingMention) {
        await supabase.from('note_mentions').insert({ note_id: noteId, person_id: personId });
      }
    }
    mentionedIds.push(personId);
  }

  // 6) Mark meeting ready + persist the linkage.
  await supabase
    .from('meeting_recordings')
    .update({
      status: 'ready',
      failed_stage: null,
      failure_reason: null,
      note_id: meetingNoteId,
      daily_briefing_note_id: dailyBriefingNoteId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', meetingId)
    .eq('user_id', userId);

  return { ok: true, meetingNoteId, dailyBriefingNoteId, mentionedPersonIds: mentionedIds };
}

export function renderMeetingBlock(input: {
  title: string;
  subject: string;
  objective: string;
  speakers: Array<{ id: string; provider_label: string; display_label: string; person_id: string | null; is_active: boolean }>;
  segments: Array<{ sequence_number: number; text: string; meeting_speaker_id: string | null }>;
  tasks: Array<{ description: string; assignee_person_id: string | null; due_at: string | null }>;
}): string {
  const speakersById = new Map<string, { display_label: string; person_id: string | null }>();
  for (const sp of input.speakers) {
    if (sp.is_active === false) continue;
    speakersById.set(sp.id, { display_label: sp.display_label, person_id: sp.person_id });
  }

  const transcriptLines = input.segments.map((s) => {
    const sp = s.meeting_speaker_id ? speakersById.get(s.meeting_speaker_id) : null;
    const label = sp ? (sp.person_id ? `@person:${sp.person_id}` : sp.display_label) : 'Falante ?';
    return `${label}: ${s.text}`;
  });

  const taskLines = input.tasks.map((t) => {
    const assignee = t.assignee_person_id ? `@person:${t.assignee_person_id} — ` : '';
    const due = t.due_at ? ` (até ${t.due_at})` : '';
    return `- ${assignee}${t.description}${due}`;
  });

  const lines = [
    `Reunião: ${input.title}`,
    '',
    'Assunto',
    input.subject || '(sem assunto)',
    '',
    'Objetivo',
    input.objective || '(sem objetivo)',
    '',
    'Transcrição',
    ...transcriptLines,
  ];
  if (taskLines.length > 0) {
    lines.push('', 'Tarefas', ...taskLines);
  }
  return lines.join('\n');
}
