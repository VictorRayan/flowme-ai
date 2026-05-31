import {
  geminiDiarizationAdapter,
  openAIDiarizationAdapter,
  routedDiarizationAdapter,
} from '@/lib/meetings/diarization-adapter';

const fakeAudio = async () => ({ data: new Uint8Array([1, 2, 3]), mimeType: 'audio/mpeg' });

const validGeminiResponse = JSON.stringify({
  detected_language: 'pt',
  segments: [
    { speaker: 'A', start_s: 0, end_s: 2.5, text: 'Bom dia.' },
    { speaker: 'B', start_s: 2.5, end_s: 5.0, text: 'Bom dia, Victor.' },
  ],
});

describe('geminiDiarizationAdapter', () => {
  it('uses the Pro model for long meetings and merges adjacent segments', async () => {
    const callGemini = jest.fn().mockResolvedValue(validGeminiResponse);
    const adapter = geminiDiarizationAdapter({ fetchAudio: fakeAudio, callGemini });
    const out = await adapter.transcribeWithDiarization({
      audioR2Key: 'meetings/m1/audio.mp3',
      audioMimeType: 'audio/mpeg',
      language: 'pt',
    });
    expect(out.providerName).toBe('gemini');
    expect(out.segments).toHaveLength(2);
    expect(callGemini).toHaveBeenCalledWith(expect.objectContaining({ model: expect.stringContaining('gemini') }));
  });

  it('passes the participants hint into the prompt but refuses real names in the output', async () => {
    const callGemini = jest.fn().mockResolvedValue(JSON.stringify({
      segments: [{ speaker: 'Joao', start_s: 0, end_s: 1, text: 'oi' }],
    }));
    const adapter = geminiDiarizationAdapter({ fetchAudio: fakeAudio, callGemini });
    await expect(adapter.transcribeWithDiarization({
      audioR2Key: 'meetings/m1/audio.mp3',
      audioMimeType: 'audio/mpeg',
      language: 'pt',
      participantsHint: ['Victor', 'Joao'],
    })).rejects.toThrow(/real-looking name/i);
  });
});

describe('openAIDiarizationAdapter', () => {
  it('parses the OpenAI diarized_json wrapper into segments', async () => {
    const callOpenAI = jest.fn().mockResolvedValue({
      raw: validGeminiResponse,
      receiptId: 'rcpt_123',
    });
    const adapter = openAIDiarizationAdapter({ fetchAudio: fakeAudio, callOpenAI });
    const out = await adapter.transcribeWithDiarization({
      audioR2Key: 'meetings/m1/audio.mp3',
      audioMimeType: 'audio/mpeg',
      language: 'pt',
    });
    expect(out.providerName).toBe('openai');
    expect(out.providerReceiptId).toBe('rcpt_123');
    expect(out.segments).toHaveLength(2);
  });
});

describe('routedDiarizationAdapter', () => {
  function fakeAdapter(out: { segments?: any[]; throwWith?: string } = {}) {
    return {
      transcribeWithDiarization: jest.fn(async () => {
        if (out.throwWith) throw new Error(out.throwWith);
        return {
          segments: out.segments ?? [
            { providerLabel: 'A', startSeconds: 0, endSeconds: 1, text: 'oi' },
          ],
          detectedLanguage: 'pt',
          providerName: 'gemini' as const,
          providerReceiptId: null,
        };
      }),
    };
  }

  it('returns primary result with no fallback reason on success', async () => {
    const router = routedDiarizationAdapter({ primary: fakeAdapter(), fallback: fakeAdapter() });
    const out = await router.transcribeWithDiarization({ audioR2Key: 'k', audioMimeType: 'audio/mp3', language: 'pt' });
    expect(out.fallbackReason).toBeNull();
    expect(out.providerName).toBe('gemini');
  });

  it('falls back to OpenAI when Gemini throws and records why', async () => {
    const primary = fakeAdapter({ throwWith: 'Diarization response was not valid JSON' });
    const fallback = {
      transcribeWithDiarization: jest.fn(async () => ({
        segments: [{ providerLabel: 'A', startSeconds: 0, endSeconds: 1, text: 'fallback' }],
        detectedLanguage: 'pt',
        providerName: 'openai' as const,
        providerReceiptId: 'rcpt',
      })),
    };
    const router = routedDiarizationAdapter({ primary, fallback });
    const out = await router.transcribeWithDiarization({ audioR2Key: 'k', audioMimeType: 'audio/mp3', language: 'pt' });
    expect(out.providerName).toBe('openai');
    expect(out.fallbackReason).toBe('gemini_invalid_json');
    expect(out.segments[0].text).toBe('fallback');
  });

  it('falls back when primary returns zero segments', async () => {
    const primary = fakeAdapter({ segments: [] });
    const fallback = fakeAdapter();
    const router = routedDiarizationAdapter({ primary, fallback });
    const out = await router.transcribeWithDiarization({ audioR2Key: 'k', audioMimeType: 'audio/mp3', language: 'pt' });
    expect(out.fallbackReason).toBe('gemini_zero_segments');
  });
});
