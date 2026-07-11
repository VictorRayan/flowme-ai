import { NextRequest } from 'next/server';
import { GET } from '@/app/api/billing/market/route';
import { resolveRequestCountry } from '@/lib/billing/ip-country';

jest.mock('@/lib/billing/ip-country', () => ({ resolveRequestCountry: jest.fn() }));

const mockResolve = resolveRequestCountry as jest.MockedFunction<typeof resolveRequestCountry>;

describe('GET /api/billing/market', () => {
  it('enables Pix only for a server-resolved Brazilian IP', async () => {
    mockResolve.mockResolvedValueOnce('BR');
    const response = await GET(new NextRequest('http://localhost/api/billing/market'));
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, countryCode: 'BR', pixAvailable: true }));
  });

  it('keeps card available while Pix fails closed outside Brazil', async () => {
    mockResolve.mockResolvedValueOnce('US');
    const response = await GET(new NextRequest('http://localhost/api/billing/market'));
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, countryCode: 'US', pixAvailable: false }));
  });

  it('fails closed when geolocation is unavailable', async () => {
    mockResolve.mockRejectedValueOnce(new Error('provider unavailable'));
    const response = await GET(new NextRequest('http://localhost/api/billing/market'));
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, countryCode: null, pixAvailable: false }));
  });
});
