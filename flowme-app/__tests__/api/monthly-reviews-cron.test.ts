import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/generate-monthly-reviews/route';
import { generateDueMonthlyReviews } from '@/lib/reviews/monthly-review';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ admin: true }),
}));

jest.mock('@/lib/reviews/monthly-review', () => ({
  generateDueMonthlyReviews: jest.fn().mockResolvedValue({ inspected: 1, generated: 1, failed: 0 }),
}));

describe('GET /api/cron/generate-monthly-reviews', () => {
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
    const res = await GET(new NextRequest('http://localhost/api/cron/generate-monthly-reviews'));
    expect(res.status).toBe(401);
  });

  it('generates due monthly reviews with cron auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/generate-monthly-reviews', {
      headers: { authorization: 'Bearer secret' },
    }));
    expect(res.status).toBe(200);
    expect(generateDueMonthlyReviews).toHaveBeenCalled();
  });
});
