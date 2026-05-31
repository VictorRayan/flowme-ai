/**
 * @jest-environment node
 */

function makeChain(listData: any[] = [], singleData: any = null, options: { headCount?: number } = {}) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null, count: options.headCount }).then(resolve as any, reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'upsert', 'or', 'contains', 'ilike', 'gte', 'lte', 'in'];
  methods.forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/r2/storage', () => ({
  uploadToR2: jest.fn().mockResolvedValue(undefined),
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example.com/x'),
  downloadFromR2: jest.fn(),
}));

import { POST as createMeeting, GET as listMeetings } from '@/app/api/meetings/route';
import { GET as getMeeting } from '@/app/api/meetings/[id]/route';
import { POST as finalize } from '@/app/api/meetings/[id]/finalize/route';
import { POST as retry } from '@/app/api/meetings/[id]/retry/route';
import { GET as audio } from '@/app/api/meetings/[id]/audio/route';
import { requireAuth } from '@/lib/api/auth';

function jsonReq(url: string, body: any, method = 'POST'): any {
  return {
    url,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    formData: async () => null,
  };
}

describe('POST /api/meetings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when consent is missing', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => makeChain([], { id: 'm1', title: 'X' }) } });
    const res = await createMeeting(jsonReq('https://x/api/meetings', { title: 'X' }) as any);
    expect(res.status).toBe(400);
  });

  it('rejects when title is missing', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => makeChain([], null) } });
    const res = await createMeeting(jsonReq('https://x/api/meetings', { consent: true }) as any);
    expect(res.status).toBe(400);
  });

  it('creates a meeting with consent and a valid title, defaulting capturedSources to ["microphone"]', async () => {
    const chain = makeChain([], { id: 'm1', title: 'Reuniao' });
    const inserted: any[] = [];
    chain.insert.mockImplementation((p: any) => { inserted.push(p); return chain; });
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => chain } });
    const res = await createMeeting(jsonReq('https://x/api/meetings', { title: 'Reuniao', consent: true }) as any);
    expect(res.status).toBe(200);
    expect(inserted[0].captured_sources).toEqual(['microphone']);
  });
});

describe('GET /api/meetings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user\'s recent meetings', async () => {
    const chain = makeChain([{ id: 'm1', title: 'X' }]);
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => chain } });
    const res = await listMeetings({ url: 'https://x/api/meetings?limit=10' } as any);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/meetings/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 when the meeting does not belong to the user', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => makeChain([], null) } });
    const res = await getMeeting({} as any, { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/meetings/[id]/finalize', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses to finalize a meeting with zero chunks', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', status: 'recording' });
    const chunkChain = makeChain([], null, { headCount: 0 });
    const sb = { from: jest.fn((table: string) => table === 'meeting_recording_chunks' ? chunkChain : meetingChain) };
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: sb });
    const res = await finalize(jsonReq('https://x', {}) as any, { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(409);
  });

  it('moves the meeting to processing when chunks exist', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', status: 'recording' });
    const chunkChain = makeChain([], null, { headCount: 3 });
    const sb = { from: jest.fn((table: string) => table === 'meeting_recording_chunks' ? chunkChain : meetingChain) };
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: sb });
    const res = await finalize(jsonReq('https://x', { duration_seconds: 1200 }) as any, { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/meetings/[id]/retry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forces from_stage=transcribe when final_audio_r2_key is already set, even if caller asks for assemble', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', status: 'failed', failed_stage: 'transcribe', final_audio_r2_key: 'meetings/m1/audio.mp3' });
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => meetingChain } });
    const res = await retry(jsonReq('https://x', { from_stage: 'assemble' }) as any, { params: Promise.resolve({ id: 'm1' }) });
    const body = await res.json();
    expect(body.from_stage).toBe('transcribe');
  });

  it('falls back to assemble when no audio has been persisted', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', status: 'failed', failed_stage: 'assemble', final_audio_r2_key: null });
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => meetingChain } });
    const res = await retry(jsonReq('https://x', { from_stage: 'summarize' }) as any, { params: Promise.resolve({ id: 'm1' }) });
    const body = await res.json();
    expect(body.from_stage).toBe('assemble');
  });
});

describe('GET /api/meetings/[id]/audio', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a signed URL when audio is persisted', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', final_audio_r2_key: 'meetings/m1/audio.mp3', final_audio_mime_type: 'audio/mpeg' });
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => meetingChain } });
    const res = await audio({} as any, { params: Promise.resolve({ id: 'm1' }) });
    const body = await res.json();
    expect(body.url).toContain('https://');
    expect(body.mime_type).toBe('audio/mpeg');
  });

  it('404 when audio has not been assembled yet', async () => {
    const meetingChain = makeChain([], { id: 'm1', user_id: 'u1', final_audio_r2_key: null });
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, supabase: { from: () => meetingChain } });
    const res = await audio({} as any, { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(404);
  });
});
