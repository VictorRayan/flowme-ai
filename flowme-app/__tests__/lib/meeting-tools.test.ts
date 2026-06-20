const mockRequireFeature = jest.fn();

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';
    constructor(feature: string) { super('Feature requires Flow Me Pro'); this.name = 'FeatureLockedError'; this.feature = feature; }
  }
  return { FeatureLockedError, requireFeature: (...args: unknown[]) => mockRequireFeature(...args) };
});

import {
  meetingsListRecentTool,
  meetingsGetDetailTool,
  meetingsSearchSegmentsTool,
} from '@/lib/ai/tools/meeting-tools';

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireFeature.mockResolvedValue({ features: { meetings: true } });
});

type Row = Record<string, any>;

function chain(rows: Row[] | Row | null) {
  const c: any = {};
  const methods = ['select', 'eq', 'order', 'limit', 'in', 'ilike', 'gte', 'lte'];
  methods.forEach((m) => { c[m] = jest.fn().mockReturnValue(c); });
  c.maybeSingle = jest.fn().mockResolvedValue({ data: Array.isArray(rows) ? rows[0] || null : rows, error: null });
  c.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: Array.isArray(rows) ? rows : (rows ? [rows] : []), error: null }).then(resolve, reject);
  return c;
}

function fakeContext(byTable: Record<string, any>): any {
  return {
    supabase: { from: jest.fn((t: string) => byTable[t] ?? chain([])) },
    user: { id: 'u1' },
    timezone: 'America/Sao_Paulo',
    nowIso: new Date().toISOString(),
  };
}

describe('meetings.list_recent', () => {
  it('blocks Free users before reading meetings', async () => {
    const { FeatureLockedError } = jest.requireMock('@/lib/billing/entitlements');
    mockRequireFeature.mockRejectedValueOnce(new FeatureLockedError('meetings'));
    const result = await meetingsListRecentTool.call({}, fakeContext({}));
    expect(result.data).toEqual(expect.objectContaining({ code: 'FEATURE_LOCKED', feature_key: 'meetings' }));
  });

  it('returns recent meetings normalized for the LLM', async () => {
    const ctx = fakeContext({
      meeting_recordings: chain([
        { id: 'm1', title: 'Reuniao A', subject: 'X', status: 'ready', failed_stage: null, duration_seconds: 1800, meeting_date: '2026-05-30', created_at: '2026-05-30T10:00:00Z', completed_at: '2026-05-30T11:00:00Z', final_audio_r2_key: 'k' },
      ]),
    });
    const out: any = await meetingsListRecentTool.call({ limit: 5 }, ctx);
    expect(out.ok).toBe(true);
    expect(out.receipt.meetings[0]).toEqual(expect.objectContaining({ id: 'm1', duration_minutes: 30, has_audio: true }));
  });

  it('filters by status when include_status is provided', async () => {
    const meetingChain = chain([]);
    const ctx = fakeContext({ meeting_recordings: meetingChain });
    await meetingsListRecentTool.call({ include_status: ['ready', 'finalization_review'] }, ctx);
    expect(meetingChain.in).toHaveBeenCalledWith('status', ['ready', 'finalization_review']);
  });
});

describe('meetings.get_detail', () => {
  it('returns a friendly error when the meeting does not belong to the user', async () => {
    const ctx = fakeContext({ meeting_recordings: chain(null) });
    const out: any = await meetingsGetDetailTool.call({ meeting_id: '00000000-0000-0000-0000-000000000000' }, ctx);
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/Não encontrei/);
  });

  it('joins segments to speaker labels and returns ordered transcript', async () => {
    const meetingChain = chain({ id: 'm1', title: 'X', subject: null, objective: null, status: 'ready', duration_seconds: 600, meeting_date: '2026-05-30', completed_at: null, summary: { speakerSummaries: [{ providerLabel: 'A', displayLabel: 'Falante A', resumoDeFalas: 'r', excerpts: [], turnCount: 1, totalSpokenSeconds: 5 }] }, final_audio_r2_key: 'k' });
    const speakersChain = chain([
      { id: 'sp-a', provider_label: 'A', display_label: 'Joao', person_id: 'p1', identity_status: 'confirmed', is_active: true },
      { id: 'sp-b', provider_label: 'B', display_label: 'Falante B', person_id: null, identity_status: 'generic', is_active: true },
    ]);
    const segmentsChain = chain([
      { sequence_number: 1, start_seconds: 0, end_seconds: 2, text: 'oi', meeting_speaker_id: 'sp-a' },
      { sequence_number: 2, start_seconds: 2, end_seconds: 4, text: 'oi tambem', meeting_speaker_id: 'sp-b' },
    ]);
    const tasksChain = chain([{ id: 't1', description: 'X', assignee_person_id: null, due_at: null, status: 'suggested' }]);
    const ctx = fakeContext({ meeting_recordings: meetingChain, meeting_speakers: speakersChain, meeting_transcript_segments: segmentsChain, meeting_tasks: tasksChain });
    const out: any = await meetingsGetDetailTool.call({ meeting_id: '11111111-1111-1111-1111-111111111111' }, ctx);
    expect(out.ok).toBe(true);
    expect(out.receipt.transcript).toHaveLength(2);
    expect(out.receipt.transcript[0].speaker_label).toBe('Joao');
    expect(out.receipt.transcript[1].speaker_label).toBe('Falante B');
    expect(out.receipt.tasks).toHaveLength(1);
    expect(out.receipt.speaker_summaries).toHaveLength(1);
  });

  it('skips the transcript when include_transcript=false', async () => {
    const meetingChain = chain({ id: 'm1', title: 'X', status: 'ready', duration_seconds: 60, meeting_date: '2026-05-30', summary: {} });
    const ctx = fakeContext({ meeting_recordings: meetingChain, meeting_speakers: chain([]), meeting_tasks: chain([]) });
    const out: any = await meetingsGetDetailTool.call({ meeting_id: '22222222-2222-2222-2222-222222222222', include_transcript: false }, ctx);
    expect(out.ok).toBe(true);
    expect(out.receipt.transcript).toHaveLength(0);
  });
});

describe('meetings.search_segments', () => {
  it('returns matches with meeting title + speaker label + snippet', async () => {
    const meetingsList = chain([{ id: 'm1', title: 'Planejamento', meeting_date: '2026-05-29' }]);
    const segments = chain([
      { meeting_recording_id: 'm1', sequence_number: 5, start_seconds: 12.3, text: 'Vamos atacar Q3 com força', meeting_speaker_id: 'sp', meeting_speakers: { display_label: 'Anna' } },
    ]);
    const ctx = fakeContext({ meeting_recordings: meetingsList, meeting_transcript_segments: segments });
    const out: any = await meetingsSearchSegmentsTool.call({ query: 'Q3' }, ctx);
    expect(out.ok).toBe(true);
    expect(out.receipt.matches[0]).toEqual(expect.objectContaining({
      meeting_id: 'm1',
      meeting_title: 'Planejamento',
      speaker_label: 'Anna',
    }));
    expect(out.receipt.matches[0].snippet).toContain('Q3');
  });

  it('returns an empty result set when the user has no meetings', async () => {
    const ctx = fakeContext({ meeting_recordings: chain([]) });
    const out: any = await meetingsSearchSegmentsTool.call({ query: 'qualquer coisa' }, ctx);
    expect(out.ok).toBe(true);
    expect(out.receipt.matches).toHaveLength(0);
  });
});
