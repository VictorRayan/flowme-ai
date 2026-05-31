import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/materialize-calendar-reminders/route';
import { materializeCalendarWhatsappReminders } from '@/lib/reminders/calendar-mirroring';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ admin: true }),
}));

jest.mock('@/lib/reminders/calendar-mirroring', () => ({
  materializeCalendarWhatsappReminders: jest.fn().mockResolvedValue({ inspected: 1, created: 1, skipped: 0 }),
}));

describe('GET /api/cron/materialize-calendar-reminders', () => {
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
    const res = await GET(new NextRequest('http://localhost/api/cron/materialize-calendar-reminders'));
    expect(res.status).toBe(401);
  });

  it('materializes due reminders with cron auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/materialize-calendar-reminders', {
      headers: { authorization: 'Bearer secret' },
    }));
    expect(res.status).toBe(200);
    expect(materializeCalendarWhatsappReminders).toHaveBeenCalled();
  });
});
