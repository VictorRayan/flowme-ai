import { NextRequest } from 'next/server';
import { GET } from '@/app/api/weekly-reviews/latest/route';
import { POST } from '@/app/api/weekly-reviews/briefing/route';
import { refreshLatestWeeklyReviewIfOutdated, saveWeeklyBriefingAndRegenerate } from '@/lib/reviews/weekly-review';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: { db: true } }),
}));

jest.mock('@/lib/reviews/weekly-review', () => ({
  refreshLatestWeeklyReviewIfOutdated: jest.fn(),
  saveWeeklyBriefingAndRegenerate: jest.fn(),
}));

describe('weekly reviews API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the latest review', async () => {
    (refreshLatestWeeklyReviewIfOutdated as jest.Mock).mockResolvedValue({ status: 'ready' });
    const res = await GET(new NextRequest('http://localhost/api/weekly-reviews/latest'));
    expect(res.status).toBe(200);
    expect((await res.json()).review.status).toBe('ready');
  });

  it('rejects an empty weekly briefing', async () => {
    const res = await POST(new NextRequest('http://localhost/api/weekly-reviews/briefing', {
      method: 'POST',
      body: JSON.stringify({ briefing: '' }),
    }));
    expect(res.status).toBe(400);
  });

  it('saves a valid weekly briefing and regenerates the review', async () => {
    (saveWeeklyBriefingAndRegenerate as jest.Mock).mockResolvedValue({ status: 'ready' });
    const res = await POST(new NextRequest('http://localhost/api/weekly-reviews/briefing', {
      method: 'POST',
      body: JSON.stringify({ briefing: 'Tive muitas reuniões urgentes.', timezone: 'America/Sao_Paulo' }),
    }));
    expect(res.status).toBe(200);
    expect(saveWeeklyBriefingAndRegenerate).toHaveBeenCalledWith(
      { db: true },
      'user-1',
      'Tive muitas reuniões urgentes.',
      { timezone: 'America/Sao_Paulo' },
    );
  });
});
