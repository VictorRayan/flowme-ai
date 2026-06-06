import { NextRequest } from 'next/server';
import { GET } from '@/app/api/briefings/run/route';
import { composeBriefing } from '@/lib/briefings/composer';
import { getBriefing, upsertBriefing } from '@/lib/briefings/persist';
import { findDueSlots } from '@/lib/briefings/scheduler';

const completeSections = {
  weather: { ok: true, data: { temperature_c: 20, condition: 'clear', city: 'São Paulo' } },
  calendar: { ok: true, data: { events: [] } },
  goal: { ok: false, data: null },
  news: { ok: true, data: { by_topic: [{ topic: 'ai', items: [{ title: 'News', summary: 'Summary', url: null, source: null }] }] } },
  trends: { ok: true, data: { trends: [{ topic: 'ai', headline: 'Trend', subheadline: 'Talk', url: 'https://x.com/a/status/1', summary: 'Talk', signals: [] }] } },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));

jest.mock('@/lib/briefings/composer', () => ({
  composeBriefing: jest.fn(),
}));

jest.mock('@/lib/briefings/scheduler', () => ({
  findDueSlots: jest.fn(),
}));

jest.mock('@/lib/briefings/persist', () => ({
  getBriefing: jest.fn(),
  upsertBriefing: jest.fn(),
  hasDeliveredChannel: jest.fn(() => true),
  markDelivered: jest.fn(),
}));

jest.mock('@/lib/briefings/deliver', () => ({
  deliverWhatsapp: jest.fn(),
  deliverWebPush: jest.fn(),
}));

describe('GET /api/briefings/run', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      CRON_SECRET: 'secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };
    (findDueSlots as jest.Mock).mockResolvedValue([{
      user: {
        user_id: 'user-1',
        briefing_timezone: 'America/Sao_Paulo',
        briefing_delivery: ['whatsapp', 'push'],
        news_topics: ['ai'],
        briefing_city: 'São Paulo',
      },
      slot: 'morning',
      briefing_date: '2026-06-06',
    }]);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('reuses an existing complete briefing instead of composing it again', async () => {
    (getBriefing as jest.Mock).mockResolvedValue({
      id: 'briefing-1',
      user_id: 'user-1',
      slot: 'morning',
      briefing_date: '2026-06-06',
      sections: completeSections,
      generated_at: '2026-06-06T10:57:00.000Z',
      delivered_at: new Date().toISOString(),
      channels_delivered: ['whatsapp', 'push'],
    });

    const res = await GET(new NextRequest('http://localhost/api/briefings/run', {
      headers: { authorization: 'Bearer secret' },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ ok: true, inspected: 1, generated: 0, reused: 1 }));
    expect(composeBriefing).not.toHaveBeenCalled();
    expect(upsertBriefing).not.toHaveBeenCalled();
  });

  it('generates when there is no complete briefing yet', async () => {
    (getBriefing as jest.Mock).mockResolvedValue(null);
    (composeBriefing as jest.Mock).mockResolvedValue(completeSections);
    (upsertBriefing as jest.Mock).mockResolvedValue({
      id: 'briefing-2',
      user_id: 'user-1',
      slot: 'morning',
      briefing_date: '2026-06-06',
      sections: completeSections,
      generated_at: new Date().toISOString(),
      delivered_at: null,
      channels_delivered: ['whatsapp', 'push'],
    });

    const res = await GET(new NextRequest('http://localhost/api/briefings/run', {
      headers: { authorization: 'Bearer secret' },
    }));
    const body = await res.json();

    expect(body).toEqual(expect.objectContaining({ ok: true, inspected: 1, generated: 1, reused: 0 }));
    expect(composeBriefing).toHaveBeenCalledTimes(1);
  });
});
