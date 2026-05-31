import { buildRitualPrompts, isRitualDue, type RitualProfile } from '@/lib/rituals/scheduler';

const profile: RitualProfile = {
  user_id: 'user-1',
  briefing_timezone: 'America/Sao_Paulo',
  notification_language: 'pt',
  daily_briefing_note_prompt_enabled: true,
  daily_briefing_note_time: '20:00',
  daily_briefing_note_channels: ['push'],
  weekly_review_enabled: true,
  weekly_review_weekday: 0,
  weekly_review_time: '18:00',
  weekly_review_channels: ['push'],
};

describe('isRitualDue', () => {
  it('allows a one-minute cron window', () => {
    expect(isRitualDue('18:00', 17 * 60 + 59)).toBe(true);
    expect(isRitualDue('18:00', 18 * 60)).toBe(true);
    expect(isRitualDue('18:00', 18 * 60 + 2)).toBe(false);
  });
});

describe('buildRitualPrompts', () => {
  it('builds the daily briefing note deep link in local time', () => {
    const prompts = buildRitualPrompts(profile, new Date('2026-05-31T23:00:00.000Z'));
    expect(prompts).toEqual([expect.objectContaining({
      ritual_kind: 'daily_briefing_note',
      occurrence_key: '2026-05-31',
      url: '/app/notes?daily_briefing=2026-05-31&focus=editor',
    })]);
  });

  it('builds a localized weekly review composer prompt on Sunday', () => {
    const prompts = buildRitualPrompts(profile, new Date('2026-05-31T21:00:00.000Z'));
    expect(prompts).toEqual([expect.objectContaining({
      ritual_kind: 'weekly_review',
      occurrence_key: '2026-05-31',
      url: '/app/ai?prompt=Iniciar%20Revis%C3%A3o%20semanal&autofocus=1',
    })]);
  });
});
