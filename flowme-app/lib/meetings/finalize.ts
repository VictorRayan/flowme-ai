// Stage 6 — commit speaker mappings, write the standalone meeting note,
// append a block to today's daily briefing note, upsert @mentions and add
// compact references to each participant's profile note.
//
// This helper is intentionally small and idempotent: a retry must produce the
// same end state without duplicating any rows.

interface SupabaseLike { from(table: string): any }

interface MentionedPerson {
  id: string;
  name: string;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
}

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

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
  const mentionedPeople = ((speakers || []) as any[])
    .filter((speaker) => speaker.person_id)
    .map((speaker) => ({ id: String(speaker.person_id), name: String(speaker.display_label) }));

  // 3) Upsert the standalone meeting note.
  const meetingNoteRow: Record<string, unknown> = {
    user_id: userId,
    title: meeting.title,
    content_text: meetingBlock,
    content: renderMeetingTipTapDoc(meetingBlock, mentionedPeople),
    note_type: 'manual',
    note_date: todayIso,
    event_id: `meeting:${meetingId}`,
  };
  let meetingNoteId: string | null = meeting.note_id;
  if (meetingNoteId) {
    const { error } = await supabase.from('notes').update({ ...meetingNoteRow, updated_at: new Date().toISOString() }).eq('id', meetingNoteId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from('notes').insert(meetingNoteRow).select('id').single();
    if (error) throw new Error(error.message);
    meetingNoteId = (data as any)?.id || null;
    if (!meetingNoteId) throw new Error('meeting_note_create_failed');
  }

  // 4) Append a compact block to today's daily briefing note (upsert by date).
  const { data: existingBriefing } = await supabase
    .from('notes')
    .select('id, content, content_text')
    .eq('user_id', userId)
    .eq('note_type', 'daily_briefing')
    .eq('note_date', todayIso)
    .maybeSingle();

  let dailyBriefingNoteId: string | null = (existingBriefing as any)?.id || null;
  if (dailyBriefingNoteId) {
    const merged = mergeMeetingBlockIntoNote({
      existingContent: (existingBriefing as any)?.content,
      existingText: String((existingBriefing as any)?.content_text || ''),
      meetingTitle: meeting.title,
      meetingBlock,
      mentionedPeople,
    });
    if (merged.appended) {
      const { error } = await supabase.from('notes').update({
        content: merged.content,
        content_text: merged.contentText,
        embedding: null,
        embedding_updated_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', dailyBriefingNoteId);
      if (error) throw new Error(error.message);
    }
  } else {
    const merged = mergeMeetingBlockIntoNote({
      existingContent: null,
      existingText: '',
      meetingTitle: meeting.title,
      meetingBlock,
      mentionedPeople,
    });
    const { data, error } = await supabase.from('notes').insert({
      user_id: userId,
      title: `Daily briefing — ${todayIso}`,
      content: merged.content,
      content_text: merged.contentText,
      note_type: 'daily_briefing',
      note_date: todayIso,
    }).select('id').single();
    if (error) throw new Error(error.message);
    dailyBriefingNoteId = (data as any)?.id || null;
    if (!dailyBriefingNoteId) throw new Error('daily_briefing_note_create_failed');
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
    const label = sp ? (sp.person_id ? `@${sp.display_label}` : sp.display_label) : 'Falante ?';
    return `${label}: ${s.text}`;
  });

  const taskLines = input.tasks.map((t) => {
    const assigneeSpeaker = input.speakers.find((speaker) => speaker.person_id === t.assignee_person_id);
    const assignee = assigneeSpeaker ? `@${assigneeSpeaker.display_label} — ` : '';
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

export function mergeMeetingBlockIntoNote(input: {
  existingContent: unknown;
  existingText: string;
  meetingTitle: string;
  meetingBlock: string;
  mentionedPeople: MentionedPerson[];
}): { appended: boolean; content: TipTapDoc; contentText: string } {
  const marker = `--- Reunião: ${input.meetingTitle} ---`;
  const existingContent = toTipTapDoc(input.existingContent);
  if (input.existingText.includes(marker)) {
    return { appended: false, content: existingContent, contentText: input.existingText };
  }

  const appendedText = `${marker}\n${input.meetingBlock}`;
  const appendedContent = renderMeetingTipTapDoc(appendedText, input.mentionedPeople);
  return {
    appended: true,
    content: { type: 'doc', content: [...existingContent.content, ...appendedContent.content] },
    contentText: [input.existingText, appendedText].filter(Boolean).join('\n\n'),
  };
}

export function renderMeetingTipTapDoc(text: string, mentionedPeople: MentionedPerson[]): TipTapDoc {
  return {
    type: 'doc',
    content: text.split('\n').map((line) => {
      if (!line) return { type: 'paragraph' };
      return { type: 'paragraph', content: buildInlineNodes(line, mentionedPeople) };
    }),
  };
}

function toTipTapDoc(content: unknown): TipTapDoc {
  if (!content || typeof content !== 'object') return { type: 'doc', content: [] };
  const doc = content as { type?: unknown; content?: unknown };
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return { type: 'doc', content: [] };
  return { type: 'doc', content: doc.content as TipTapNode[] };
}

function buildInlineNodes(line: string, mentionedPeople: MentionedPerson[]): TipTapNode[] {
  const sortedPeople = [...mentionedPeople].sort((a, b) => b.name.length - a.name.length);
  const nodes: TipTapNode[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const match = sortedPeople
      .map((person) => ({ person, index: line.indexOf(`@${person.name}`, cursor) }))
      .filter((candidate) => candidate.index >= 0)
      .sort((a, b) => a.index - b.index)[0];

    if (!match) {
      nodes.push({ type: 'text', text: line.slice(cursor) });
      break;
    }
    if (match.index > cursor) nodes.push({ type: 'text', text: line.slice(cursor, match.index) });
    nodes.push({ type: 'mention', attrs: { id: match.person.id, label: match.person.name } });
    cursor = match.index + match.person.name.length + 1;
  }

  return nodes;
}
