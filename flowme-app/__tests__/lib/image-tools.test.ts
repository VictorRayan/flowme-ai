import { GoogleGenAI } from '@google/genai';
import { imagesGenerateTool, buildGeneratedImageKey, buildGeneratedImageUrl } from '@/lib/ai/tools/image-tools';
import { uploadToR2 } from '@/lib/r2/storage';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

jest.mock('@/lib/r2/storage', () => ({
  uploadToR2: jest.fn(),
}));

const context = {
  user: { id: 'user-1' },
  supabase: {},
  timezone: 'America/Sao_Paulo',
  nowIso: '2026-05-31T12:00:00.000Z',
} as any;

describe('images.generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('generates a PNG, uploads it to R2, and returns a chat attachment URL', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ inlineData: { data: Buffer.from('png-bytes').toString('base64'), mimeType: 'image/png' } }],
        },
      }],
    });

    const result: any = await imagesGenerateTool.call({ prompt: 'A calm blue home office' }, context);

    expect(result.ok).toBe(true);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash-image',
      contents: 'A calm blue home office',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    }));
    expect(uploadToR2).toHaveBeenCalledWith(expect.objectContaining({
      key: expect.stringMatching(/^users\/user-1\/generated-images\/.+\.png$/),
      body: Buffer.from('png-bytes'),
      contentType: 'image/png',
    }));
    expect(result.receipt.image).toEqual(expect.objectContaining({
      type: 'image',
      mimeType: 'image/png',
      url: expect.stringMatching(/^\/api\/ai\/images\?key=/),
    }));
  });

  it('returns a configuration error without a Gemini key', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await imagesGenerateTool.call({ prompt: 'A poster' }, context);
    expect(result).toEqual({ ok: false, error: 'Gemini image generation is not configured.' });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('builds stable storage keys and encoded URLs', () => {
    const key = buildGeneratedImageKey('user-1', 'image-1.png');
    expect(key).toBe('users/user-1/generated-images/image-1.png');
    expect(buildGeneratedImageUrl(key)).toBe('/api/ai/images?key=users%2Fuser-1%2Fgenerated-images%2Fimage-1.png');
  });
});
