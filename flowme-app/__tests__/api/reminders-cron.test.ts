import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/send-reminders/route';
import { sendDueReminders } from '@/lib/reminders/reminders';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ admin: true }),
}));

jest.mock('@/lib/reminders/reminders', () => ({
  sendDueReminders: jest.fn().mockResolvedValue({ inspected: 1, sent: 1, failed: 0, skipped: 0 }),
}));

describe('GET /api/cron/send-reminders', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
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

  it('rejects unauthorized manual calls', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/send-reminders'));
    expect(res.status).toBe(401);
  });

  it('sends due reminders with cron auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/send-reminders', {
      headers: { authorization: 'Bearer secret' },
    }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sendDueReminders).toHaveBeenCalled();
  });
});

