import { NextRequest } from 'next/server';
import { GET } from '@/app/api/billing/credits/route';
import { getAiCreditState } from '@/lib/billing/credits';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));

jest.mock('@/lib/billing/credits', () => {
  const actual = jest.requireActual('@/lib/billing/credits');
  return { ...actual, getAiCreditState: jest.fn() };
});

const mockedGetState = getAiCreditState as jest.MockedFunction<typeof getAiCreditState>;

describe('GET /api/billing/credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetState.mockResolvedValue({
      allowed: true,
      plan_code: 'free',
      unlimited: false,
      daily_limit: 10,
      used: 3,
      remaining: 7,
      local_date: '2026-06-20',
      timezone: 'America/Sao_Paulo',
      resets_at: '2026-06-21T03:00:00.000Z',
    });
  });

  it('returns the current daily credit meter', async () => {
    const response = await GET(new NextRequest('http://localhost/api/billing/credits?timezone=America%2FSao_Paulo'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.credits.remaining).toBe(7);
    expect(mockedGetState).toHaveBeenCalledWith({}, 'user-1', 'America/Sao_Paulo');
  });

  it('rejects an invalid timezone', async () => {
    const response = await GET(new NextRequest('http://localhost/api/billing/credits?timezone=not-a-timezone'));
    expect(response.status).toBe(400);
    expect(mockedGetState).not.toHaveBeenCalled();
  });
});
