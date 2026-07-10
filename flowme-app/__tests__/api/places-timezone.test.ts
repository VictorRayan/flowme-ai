import { NextRequest } from 'next/server';
import timezoneLookup from '@photostructure/tz-lookup';
import { GET } from '@/app/api/places/timezone/route';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));

jest.mock('@photostructure/tz-lookup', () => jest.fn(() => 'America/Sao_Paulo'));

describe('GET /api/places/timezone', () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.GOOGLE_MAPS_API_KEY = originalKey;
    else delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it('resolves an IANA timezone from city coordinates', async () => {
    const response = await GET(new NextRequest('http://localhost/api/places/timezone?latitude=-23.5505&longitude=-46.6333'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timezone).toBe('America/Sao_Paulo');
    expect(timezoneLookup).toHaveBeenCalledWith(-23.5505, -46.6333);
  });

  it('rejects missing or invalid coordinates', async () => {
    const response = await GET(new NextRequest('http://localhost/api/places/timezone?latitude=999&longitude=999'));
    expect(response.status).toBe(400);
  });

  it('uses Google place details and timezone when configured', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'maps-key';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: { geometry: { location: { lat: -23.55, lng: -46.63 } } } }) })
      .mockResolvedValueOnce({ json: async () => ({ status: 'OK', timeZoneId: 'America/Sao_Paulo' }) });

    const response = await GET(new NextRequest('http://localhost/api/places/timezone?place_id=place-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timezone).toBe('America/Sao_Paulo');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
