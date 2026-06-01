import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/generate-weekly-reviews/route';
import { generateDueWeeklyReviews } from '@/lib/reviews/weekly-review';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ admin: true }),
}));

jest.mock('@/lib/reviews/weekly-review', () => ({
  generateDueWeeklyReviews: jest.fn().mockResolvedValue({ inspected: 1, generated: 1, awaiting_briefing: 0, failed: 0 }),
}));

describe('GET /api/cron/generate-weekly-reviews', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...oldEnv,
      CRON_SECRET: 'secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('rejects unauthorized calls', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/generate-weekly-reviews'));
    expect(res.status).toBe(401);
  });

  it('generates due reviews with cron auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/generate-weekly-reviews', {
      headers: { authorization: 'Bearer secret' },
    }));
    expect(res.status).toBe(200);
    expect(generateDueWeeklyReviews).toHaveBeenCalled();
  });
});
