import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/send-event-checkins/route';
import { deliverPostEventCheckins } from '@/lib/today/post-event-checkins';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ admin: true }),
}));

jest.mock('@/lib/today/post-event-checkins', () => ({
  deliverPostEventCheckins: jest.fn().mockResolvedValue({ inspected: 1, sent: 2, failed: 0, skipped: 0 }),
}));

describe('GET /api/cron/send-event-checkins', () => {
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
    const res = await GET(new NextRequest('http://localhost/api/cron/send-event-checkins'));
    expect(res.status).toBe(401);
  });

  it('delivers due event check-ins with cron auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/send-event-checkins', {
      headers: { authorization: 'Bearer secret' },
    }));
    expect(res.status).toBe(200);
    expect(deliverPostEventCheckins).toHaveBeenCalled();
  });
});
