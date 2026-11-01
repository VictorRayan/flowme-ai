import { NextRequest } from 'next/server';
import { GET as checkConnectors } from '@/app/api/cron/check-connectors/route';
import { GET as sendReminders } from '@/app/api/cron/send-reminders/route';
import { GET as summarizeThreads } from '@/app/api/cron/summarize-stale-threads/route';

describe('cron authorization', () => {
  const previousSecret = process.env.CRON_SECRET;

  beforeEach(() => { process.env.CRON_SECRET = 'test-cron-secret'; });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  it.each([
    ['check-connectors', checkConnectors],
    ['send-reminders', sendReminders],
    ['summarize-stale-threads', summarizeThreads],
  ])('rejects a spoofed Vercel cron header on %s', async (route, handler) => {
    const response = await handler(new NextRequest(`http://localhost/api/cron/${route}`, {
      headers: { 'x-vercel-cron': '1' },
    }));
    expect(response.status).toBe(401);
  });
});
