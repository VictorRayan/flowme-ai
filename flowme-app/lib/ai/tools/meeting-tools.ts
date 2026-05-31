import { z } from 'zod';
import { defineTool, type ToolContext } from './Tool';

interface MeetingRow {
  id: string;
  title: string;
  subject: string | null;
  objective: string | null;
  status: string;
  failed_stage: string | null;
  duration_seconds: number;
  meeting_date: string;
  created_at: string;
  completed_at: string | null;
  final_audio_r2_key: string | null;
}

const NOT_FOUND_ERROR = 'Não encontrei essa reunião nas suas notas.';

export const meetingsListRecentTool = defineTool({
  name: 'meetings.list_recent',
  description: `List the user's recent meeting recordings, newest first.

WHEN TO USE: "minhas últimas reuniões", "que reunião eu tive hoje?", "list my meetings this week".

CONTRACT:
- limit: max meetings to return (1–50, default 10).
- include_status: optional list of statuses to filter (e.g. ['ready', 'finalization_review']).
- Returns: id, title, subject, status, duration_minutes, meeting_date, has_audio. Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    include_status: z.array(z.string()).optional(),
  }),
  call: async (args, context) => {
    const limit = args.limit ?? 10;
    let query = context.supabase
      .from('meeting_recordings')
      .select('id, title, subject, status, failed_stage, duration_seconds, meeting_date, created_at, completed_at, final_audio_r2_key')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (Array.isArray(args.include_status) && args.include_status.length > 0) {
      query = query.in('status', args.include_status);
    }
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    const meetings = ((data || []) as MeetingRow[]).map((m) => ({
      id: m.id,
      title: m.title,
      subject: m.subject,
      status: m.status,
      failed_stage: m.failed_stage,
      duration_minutes: Math.round((m.duration_seconds || 0) / 60),
      meeting_date: m.meeting_date,
      completed_at: m.completed_at,
      has_audio: Boolean(m.final_audio_r2_key),
    }));
    return { ok: true, receipt: { meetings, count: meetings.length } };
  },
});

export const meetingsGetDetailTool = defineTool({
  name: 'meetings.get_detail',
  description: `Read the full transcript, speakers and tasks of a single meeting.

WHEN TO USE: "resume a reunião com Anna", "que tasks saíram da reunião de planejamento?", "what did we agree on last meeting?".

CONTRACT:
- meeting_id: required. Use meetings.list_recent first to discover ids.
- include_transcript: include the full segment-by-segment transcript (default true).
- Returns: title, subject, objective, status, speakers, segments (with speaker labels), tasks. Read-only.

LIMIT: transcripts can be long. Default returns up to 200 segments; pass include_transcript=false when the user only wants the summary.`,
  isReadOnly: true,
  inputSchema: z.object({
    meeting_id: z.string().uuid().describe('Meeting id, obtained via meetings.list_recent or meetings.search_segments.'),
    include_transcript: z.boolean().optional(),
  }),
  call: async (args, context) => {
    const includeTranscript = args.include_transcript !== false;

    const { data: meeting } = await context.supabase
      .from('meeting_recordings')
      .select('id, title, subject, objective, status, duration_seconds, meeting_date, completed_at, summary, final_audio_r2_key')
      .eq('id', args.meeting_id)
      .eq('user_id', context.user.id)
      .maybeSingle();
    if (!meeting) return { ok: false, error: NOT_FOUND_ERROR };

    const [speakersRes, segmentsRes, tasksRes] = await Promise.all([
      context.supabase
        .from('meeting_speakers')
        .select('id, provider_label, display_label, person_id, identity_status, is_active')
        .eq('meeting_recording_id', args.meeting_id)
        .order('provider_label', { ascending: true }),
      includeTranscript
        ? context.supabase
            .from('meeting_transcript_segments')
            .select('sequence_number, start_seconds, end_seconds, text, meeting_speaker_id')
            .eq('meeting_recording_id', args.meeting_id)
            .order('sequence_number', { ascending: true })
            .limit(200)
        : Promise.resolve({ data: [] }),
      context.supabase
        .from('meeting_tasks')
        .select('id, description, assignee_person_id, due_at, status')
        .eq('meeting_recording_id', args.meeting_id)
        .order('created_at', { ascending: true }),
    ]);

    const speakers = (speakersRes.data || []) as any[];
    const speakerById = new Map(speakers.map((s) => [s.id, s]));
    const transcript = ((segmentsRes.data || []) as any[]).map((seg) => ({
      sequence_number: seg.sequence_number,
      start_seconds: Number(seg.start_seconds),
      end_seconds: Number(seg.end_seconds),
      speaker_label: seg.meeting_speaker_id ? speakerById.get(seg.meeting_speaker_id)?.display_label || 'Falante ?' : 'Falante ?',
      person_id: seg.meeting_speaker_id ? speakerById.get(seg.meeting_speaker_id)?.person_id || null : null,
      text: seg.text,
    }));

    return {
      ok: true,
      receipt: {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          subject: meeting.subject,
          objective: meeting.objective,
          status: meeting.status,
          duration_minutes: Math.round((meeting.duration_seconds || 0) / 60),
          meeting_date: meeting.meeting_date,
          completed_at: meeting.completed_at,
          has_audio: Boolean(meeting.final_audio_r2_key),
        },
        speakers: speakers.filter((s) => s.is_active !== false).map((s) => ({
          display_label: s.display_label,
          provider_label: s.provider_label,
          person_id: s.person_id,
          identity_status: s.identity_status,
        })),
        transcript,
        tasks: ((tasksRes.data || []) as any[]).map((t) => ({
          id: t.id,
          description: t.description,
          assignee_person_id: t.assignee_person_id,
          due_at: t.due_at,
          status: t.status,
        })),
        speaker_summaries: (meeting.summary?.speakerSummaries || []) as any[],
      },
    };
  },
});

export const meetingsSearchSegmentsTool = defineTool({
  name: 'meetings.search_segments',
  description: `Search transcript segments across all of the user's meetings by a keyword.

WHEN TO USE: "quem me falou de Q3 na última semana?", "what did Anna say about the launch?", "qual reunião falamos do projeto X?".

CONTRACT:
- query: required, 2–200 chars. Case-insensitive substring search against segment text.
- limit: max matches, default 10 (1–30).
- since_days: optional. Limit search to meetings created within the last N days (default no limit).
- Returns: matches with meeting_id, meeting_title, sequence_number, speaker_label, ts, snippet. Read-only.

LIMIT: scans up to 500 segments via Postgres ilike — fast enough for personal use, not a substitute for full-text search.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(30).optional(),
    since_days: z.number().int().min(1).max(365).optional(),
  }),
  call: async (args, context) => {
    const limit = args.limit ?? 10;
    const sinceIso = args.since_days
      ? new Date(Date.now() - args.since_days * 86_400_000).toISOString()
      : null;

    let meetingsQuery = context.supabase
      .from('meeting_recordings')
      .select('id, title, meeting_date')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (sinceIso) meetingsQuery = meetingsQuery.gte('created_at', sinceIso);
    const { data: meetingsRows } = await meetingsQuery;
    const meetings = (meetingsRows || []) as Array<{ id: string; title: string; meeting_date: string }>;
    if (meetings.length === 0) return { ok: true, receipt: { matches: [], count: 0 } };

    const meetingById = new Map(meetings.map((m) => [m.id, m]));

    const { data: segments } = await context.supabase
      .from('meeting_transcript_segments')
      .select('meeting_recording_id, sequence_number, start_seconds, text, meeting_speaker_id, meeting_speakers(display_label)')
      .in('meeting_recording_id', meetings.map((m) => m.id))
      .ilike('text', `%${args.query.replace(/[%_]/g, '\\$&')}%`)
      .limit(limit);

    const matches = ((segments || []) as any[]).map((s) => {
      const meeting = meetingById.get(s.meeting_recording_id);
      return {
        meeting_id: s.meeting_recording_id,
        meeting_title: meeting?.title || '(reunião)',
        meeting_date: meeting?.meeting_date || null,
        sequence_number: s.sequence_number,
        start_seconds: Number(s.start_seconds),
        speaker_label: s.meeting_speakers?.display_label || 'Falante ?',
        snippet: String(s.text || '').slice(0, 280),
      };
    });

    return { ok: true, receipt: { matches, count: matches.length } };
  },
});

export const MEETINGS_TOOLS = [
  meetingsListRecentTool,
  meetingsGetDetailTool,
  meetingsSearchSegmentsTool,
];
