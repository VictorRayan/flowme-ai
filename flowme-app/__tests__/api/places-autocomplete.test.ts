import { NextRequest } from 'next/server';
import { GET } from '@/app/api/places/autocomplete/route';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));

describe('GET /api/places/autocomplete', () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalKey) process.env.GOOGLE_MAPS_API_KEY = originalKey;
    else delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it('returns no options before two characters', async () => {
    const response = await GET(new NextRequest('http://localhost/api/places/autocomplete?q=S'));
    await expect(response.json()).resolves.toMatchObject({ predictions: [] });
  });

  it('returns structured city, state — country options', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        place_id: 123,
        lat: '-23.5505',
        lon: '-46.6333',
        address: { city: 'São Paulo', state: 'São Paulo', country: 'Brasil' },
      }],
    });

    const response = await GET(new NextRequest('http://localhost/api/places/autocomplete?q=Sao&language=pt-BR'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.predictions).toEqual([expect.objectContaining({
      label: 'São Paulo, São Paulo — Brasil',
      latitude: -23.5505,
      longitude: -46.6333,
    })]);
  });
});
