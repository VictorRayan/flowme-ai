import { NextRequest } from 'next/server';
import { GET } from '@/app/api/ai/images/route';
import { downloadFromR2 } from '@/lib/r2/storage';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));

jest.mock('@/lib/r2/storage', () => ({
  downloadFromR2: jest.fn(),
}));

describe('GET /api/ai/images', () => {
  beforeEach(() => jest.clearAllMocks());

  it('streams an image owned by the authenticated user', async () => {
    (downloadFromR2 as jest.Mock).mockResolvedValue({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('image-bytes'));
          controller.close();
        },
      }),
      contentType: 'image/png',
      contentLength: 11,
    });

    const request = new NextRequest('http://localhost/api/ai/images?key=users%2Fuser-1%2Fgenerated-images%2Fimage-1.png');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(await response.text()).toBe('image-bytes');
  });

  it('rejects image keys owned by another user', async () => {
    const request = new NextRequest('http://localhost/api/ai/images?key=users%2Fuser-2%2Fgenerated-images%2Fimage-1.png');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(downloadFromR2).not.toHaveBeenCalled();
  });
});

