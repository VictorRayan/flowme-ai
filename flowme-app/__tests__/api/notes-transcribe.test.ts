const transcriptionsCreate = jest.fn();
const completionsCreate = jest.fn();

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  audio: { transcriptions: { create: transcriptionsCreate } },
  chat: { completions: { create: completionsCreate } },
})));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ supabase: {}, user: { id: 'user-1' } }),
}));

jest.mock('@/lib/ai/billing', () => ({
  logAiUsage: jest.fn().mockResolvedValue(undefined),
  estimateTokensFromText: jest.fn().mockReturnValue(10),
}));

import { POST } from '@/app/api/notes/transcribe/route';
import { logAiUsage } from '@/lib/ai/billing';

function makeRequest(fields: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = { audio: { name: 'rec.webm' }, ...fields };
  return {
    formData: async () => ({ get: (key: string) => (key in map ? map[key] : null) }),
  } as any;
}

describe('POST /api/notes/transcribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai';
    process.env.GEMINI_API_KEY = 'test-gemini';
    global.fetch = jest.fn();
  });

  it('transcribes with Whisper and formats with the newest Gemini Flash', async () => {
    transcriptionsCreate.mockResolvedValue('olá, isso é uma nota de voz');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '<h2>Nota</h2><p>olá</p>' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8 },
      }),
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(transcriptionsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'whisper-1' }));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('gemini-3-flash-preview');
    expect(data.html).toBe('<h2>Nota</h2><p>olá</p>');
    expect(data.rawTranscription).toBe('olá, isso é uma nota de voz');
    expect(completionsCreate).not.toHaveBeenCalled();
    expect(logAiUsage).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini', model: 'gemini-3-flash-preview' }));
  });

  it('falls back to OpenAI formatting when Gemini fails', async () => {
    transcriptionsCreate.mockResolvedValue('olá mundo');
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, text: async () => 'quota exceeded' });
    completionsCreate.mockResolvedValue({
      choices: [{ message: { content: '<p>olá mundo</p>' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(data.html).toBe('<p>olá mundo</p>');
    expect(completionsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini' }));
    expect(logAiUsage).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' }));
  });

  it('returns an empty paragraph and skips formatting when transcription is blank', async () => {
    transcriptionsCreate.mockResolvedValue('   ');

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(data.html).toBe('<p></p>');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(completionsCreate).not.toHaveBeenCalled();
  });
});
