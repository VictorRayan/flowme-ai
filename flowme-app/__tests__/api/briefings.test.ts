import { NextRequest } from 'next/server';
import { GET } from '@/app/api/briefings/route';
import { composeBriefing } from '@/lib/briefings/composer';
import { getBriefing, upsertBriefing } from '@/lib/briefings/persist';

const mockCompleteSections = {
  weather: { ok: true, data: { temperature_c: 17, condition: 'Clima', city: 'São Paulo' } },
  calendar: { ok: true, data: { events: [] } },
  goal: { ok: false, data: null },
  news: { ok: true, data: { by_topic: [{ topic: 'tecnologia', items: [{ title: 'Notícia', summary: 'Resumo', url: null, source: null }] }] } },
  trends: { ok: true, data: { trends: [{ topic: 'tecnologia', summary: 'Discussão em alta', signals: [] }] } },
};

const inmockCompleteSections = {
  weather: { ok: false, data: null },
  calendar: { ok: true, data: { events: [] } },
  goal: { ok: false, data: null },
  news: { ok: false, data: null, error: 'Sem notícias agora' },
  trends: { ok: false, data: null, error: 'Sem trends agora' },
};

function makeSupabase() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        briefing_timezone: 'America/Sao_Paulo',
        news_topics: [],
        briefing_city: 'São Paulo',
        morning_briefing_time: '08:00',
        evening_briefing_time: '20:00',
      },
      error: null,
    }),
  };
  return { from: jest.fn().mockReturnValue(chain) };
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() => Promise.resolve({
    user: { id: 'user-1' },
    supabase: makeSupabase(),
  })),
}));

jest.mock('@/lib/briefings/composer', () => ({
  composeBriefing: jest.fn(),
}));

jest.mock('@/lib/briefings/persist', () => ({
  getBriefing: jest.fn(),
  upsertBriefing: jest.fn().mockImplementation((_supabase, userId, input) => Promise.resolve({
    id: 'briefing-2',
    user_id: userId,
    slot: input.slot,
    briefing_date: input.briefing_date,
    sections: input.sections,
    generated_at: '2026-05-25T00:00:00.000Z',
    delivered_at: null,
    channels_delivered: [],
  })),
}));

describe('GET /api/briefings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (composeBriefing as jest.Mock).mockResolvedValue(mockCompleteSections);
  });

  it('reuses a saved briefing when news and trends are already populated', async () => {
    (getBriefing as jest.Mock).mockResolvedValue({
      id: 'briefing-1',
      user_id: 'user-1',
      slot: 'evening',
      briefing_date: '2026-05-25',
      sections: mockCompleteSections,
      generated_at: '2026-05-25T00:00:00.000Z',
      delivered_at: null,
      channels_delivered: [],
    });

    const res = await GET(new NextRequest('http://localhost/api/briefings?slot=evening'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.briefing.id).toBe('briefing-1');
    expect(composeBriefing).not.toHaveBeenCalled();
    expect(upsertBriefing).not.toHaveBeenCalled();
  });

  it('regenerates a saved briefing when news or trends are empty', async () => {
    (getBriefing as jest.Mock).mockResolvedValue({
      id: 'briefing-1',
      user_id: 'user-1',
      slot: 'evening',
      briefing_date: '2026-05-25',
      sections: inmockCompleteSections,
      generated_at: '2026-05-25T00:00:00.000Z',
      delivered_at: null,
      channels_delivered: [],
    });

    const res = await GET(new NextRequest('http://localhost/api/briefings?slot=evening'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(composeBriefing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      slot: 'evening',
      news_topics: [],
      city: 'São Paulo',
    }));
    expect(upsertBriefing).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.objectContaining({
      slot: 'evening',
      sections: mockCompleteSections,
    }));
    expect(body.briefing.sections.news.ok).toBe(true);
    expect(body.briefing.sections.trends.ok).toBe(true);
  });

  it('returns a composed briefing even when persistence fails for a newer slot', async () => {
    (getBriefing as jest.Mock).mockResolvedValue(null);
    (upsertBriefing as jest.Mock).mockResolvedValue(null);

    const res = await GET(new NextRequest('http://localhost/api/briefings?slot=afternoon'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.briefing.slot).toBe('afternoon');
    expect(body.briefing.persisted).toBe(false);
    expect(body.briefing.sections.news.ok).toBe(true);
  });
});
