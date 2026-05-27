import { composeBriefing, dateInTimezone } from '@/lib/briefings/composer';
import { summarizeForWhatsapp } from '@/lib/briefings/deliver';
import { hasDeliveredChannel } from '@/lib/briefings/persist';
import { webGroundedSearchTool } from '@/lib/ai/tools/web-tools';
import { trendsFromTopicsTool } from '@/lib/ai/tools/trends-tools';

jest.mock('@/lib/ai/tools/weather-tools', () => ({
  weatherGetTool: { call: jest.fn().mockResolvedValue({ ok: true, receipt: { temperature_c: 17, feels_like_c: 16, precipitation_mm: 0, weather_code: 2, condition: 'Clima', city: 'São Paulo' } }) },
}));

jest.mock('@/lib/ai/tools/calendar-tools', () => ({
  calendarListEventsTool: { call: jest.fn().mockResolvedValue({
    ok: true,
    receipt: {
      events: [{
        title: 'Dedicar por dia, de segunda a domingo, às 21:00, para estudar Clean Architecture, trabalhando em cursos, projetos práticos e revisões.',
        start_at: '2026-05-25T21:00:00.000Z',
      }],
    },
  }) },
}));

jest.mock('@/lib/ai/tools/web-tools', () => ({
  webGroundedSearchTool: { call: jest.fn().mockResolvedValue({ ok: false, error: 'no news' }) },
}));

jest.mock('@/lib/ai/tools/trends-tools', () => ({
  trendsFromTopicsTool: { call: jest.fn().mockResolvedValue({ ok: false, error: 'no trends' }) },
}));

function makeSupabase(goalRows: unknown[]) {
  return {
    from(table: string) {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then(resolve: Function, reject: Function) {
          const data = table === 'goal_calendar_events' ? goalRows : [];
          return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
        },
      };
      return chain;
    },
  };
}

describe('briefings', () => {
  beforeEach(() => {
    (webGroundedSearchTool.call as jest.Mock).mockResolvedValue({ ok: false, error: 'no news' });
  });

  it('does not redeliver a channel already marked on a briefing row', () => {
    expect(hasDeliveredChannel({ channels_delivered: ['whatsapp'] }, 'whatsapp')).toBe(true);
    expect(hasDeliveredChannel({ channels_delivered: ['whatsapp'] }, 'push')).toBe(false);
    expect(hasDeliveredChannel({ channels_delivered: null }, 'whatsapp')).toBe(false);
  });

  it('puts the app CTA near the top and shortens verbose agenda titles for WhatsApp', () => {
    const text = summarizeForWhatsapp('evening', {
      weather: { ok: false, data: null },
      calendar: { ok: true, data: { events: [{
        title: 'Dedicar por dia, de segunda a domingo, às 21:00, para estudar Clean Architecture, trabalhando em cursos, projetos práticos e revisões.',
        start_at: '2026-05-25T21:00:00.000Z',
      }] } },
      goal: { ok: true, data: { title: 'Estudar Clean Architecture', status: 'in_progress' } },
      news: { ok: false, data: null },
      trends: { ok: false, data: null },
    });

    expect(text.split('\n')[1]).toContain('Abrir no app:');
    expect(text).toContain('— Estudar Clean Architecture');
    expect(text).not.toContain('trabalhando em cursos');
  });

  it('uses today executable goal calendar event as the briefing goal', async () => {
    const sections = await composeBriefing({
      supabase: makeSupabase([{
        title: 'Dedicar por dia, de segunda a domingo, às 21:00, para estudar Clean Architecture, trabalhando em cursos, projetos práticos e revisões.',
        status: 'active',
        start_at: '2026-05-25T21:00:00.000Z',
      }]) as any,
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-25T12:00:00.000Z',
    } as any, {
      slot: 'evening',
      news_topics: [],
      city: 'São Paulo',
    });

    expect(sections.goal.ok).toBe(true);
    expect(sections.goal.data?.title).toBe('Estudar Clean Architecture');
    expect(sections.calendar.data?.events[0].title).toBe('Estudar Clean Architecture');
    expect(sections.weather.data?.advice).toBe('Noite fria: vale sair com agasalho.');
  });

  it('uses default topics for news and never substitutes web summaries for X trends', async () => {
    (webGroundedSearchTool.call as jest.Mock).mockResolvedValue({
      ok: true,
      receipt: {
        answer: 'Resumo atual sobre o tema com sinais relevantes para o dia.',
        citations: [{ title: 'Fonte relevante', url: 'https://example.com/news' }],
      },
    });

    const sections = await composeBriefing({
      supabase: makeSupabase([{ title: 'Estudar Clean Architecture', status: 'active', start_at: '2026-05-25T21:00:00.000Z' }]) as any,
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-25T12:00:00.000Z',
    } as any, {
      slot: 'evening',
      news_topics: [],
      city: 'São Paulo',
    });

    expect(sections.news.ok).toBe(true);
    expect(sections.news.data?.by_topic[0].topic).toBe('inteligência artificial');
    // Trends come ONLY from X.com. With the X tool failing, the section stays
    // empty — no Gemini/web fallback is substituted in.
    expect(sections.trends.ok).toBe(false);
  });

  it('renders distinct headline + subheadline per news item instead of one repeated block', async () => {
    (webGroundedSearchTool.call as jest.Mock).mockResolvedValue({
      ok: true,
      receipt: {
        answer: JSON.stringify({ items: [
          { headline: 'Bitcoin sobe 4% no dia', subheadline: 'Alta puxada por fluxo institucional em ETFs.' },
          { headline: 'Nova regulação cripto avança', subheadline: 'Projeto passa em comissão e segue para votação.' },
        ] }),
        citations: [
          { title: 'binance.com', url: 'https://vertexaisearch.cloud.google.com/a' },
          { title: 'exame.com', url: 'https://vertexaisearch.cloud.google.com/b' },
        ],
      },
    });

    const sections = await composeBriefing({
      supabase: makeSupabase([]) as any,
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-25T12:00:00.000Z',
    } as any, {
      slot: 'morning',
      news_topics: ['bitcoin'],
      city: 'São Paulo',
    });

    const items = sections.news.data?.by_topic[0].items || [];
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Bitcoin sobe 4% no dia');
    expect(items[0].summary).toBe('Alta puxada por fluxo institucional em ETFs.');
    expect(items[0].source).toBe('binance.com');
    expect(items[1].title).toBe('Nova regulação cripto avança');
    // Distinct summaries — not the same block repeated.
    expect(items[0].summary).not.toBe(items[1].summary);
  });

  it('passes through real X.com trends with headline and subheadline', async () => {
    (trendsFromTopicsTool.call as jest.Mock).mockResolvedValueOnce({
      ok: true,
      receipt: { trends: [{
        topic: 'IA',
        headline: 'Debate sobre IA generativa esquenta no X',
        subheadline: 'Usuários discutem limites e regulação após novo lançamento.',
        url: 'https://x.com/foo/status/1',
        summary: 'Usuários discutem limites e regulação após novo lançamento.',
        signals: [],
      }] },
    });

    const sections = await composeBriefing({
      supabase: makeSupabase([]) as any,
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-25T12:00:00.000Z',
    } as any, {
      slot: 'morning',
      news_topics: ['IA'],
      city: 'São Paulo',
    });

    expect(sections.trends.ok).toBe(true);
    expect(sections.trends.data?.trends[0].headline).toBe('Debate sobre IA generativa esquenta no X');
    expect(sections.trends.data?.trends[0].subheadline).toBe('Usuários discutem limites e regulação após novo lançamento.');
  });

  it('keeps the afternoon calendar window within today and gives afternoon weather advice', async () => {
    const sections = await composeBriefing({
      supabase: makeSupabase([]) as any,
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-25T15:00:00.000Z',
    } as any, {
      slot: 'afternoon',
      news_topics: [],
      city: 'São Paulo',
    });

    // Mocked weather feels like 16°C → cold-afternoon advice.
    expect(sections.weather.data?.advice).toBe('Tarde fria: um agasalho cai bem.');
  });

  it('formats the local date in the requested timezone', () => {
    expect(dateInTimezone(new Date('2026-05-25T02:30:00.000Z'), 'America/Sao_Paulo')).toBe('2026-05-24');
  });
});
