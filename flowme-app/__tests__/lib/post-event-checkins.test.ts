import { buildPostEventCheckinPrompt } from '@/lib/today/post-event-checkins';

describe('buildPostEventCheckinPrompt', () => {
  it('uses an opaque token instead of exposing the Google event id in the URL', () => {
    const prompt = buildPostEventCheckinPrompt({
      accountId: 'account-1',
      eventId: 'google-event-secret',
      eventTitle: 'Deep work',
      endAt: '2026-05-31T20:00:00.000Z',
      token: 'opaque-token',
      language: 'pt',
    });
    expect(prompt.task_id).toBe('calendar_event:google-event-secret');
    expect(prompt.url).toBe('/app/today?focus=opaque-token');
    expect(prompt.url).not.toContain('google-event-secret');
  });
});
