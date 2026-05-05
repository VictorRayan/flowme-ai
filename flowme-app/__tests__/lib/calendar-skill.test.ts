import { parseCalendarActionRuleBased } from '@/lib/ai/calendar-skill';

describe('parseCalendarActionRuleBased', () => {
  it('asks for a time instead of creating when title and date are present but time is missing', () => {
    const result = parseCalendarActionRuleBased({
      text: 'Previous user context:\nuser: create the event please\n\nLatest user request: Test for Google 123 for today',
      nowIso: '2026-05-01T23:14:05.000Z',
      timezone: 'America/Sao_Paulo',
    });

    expect(result?.intent).toBe('create');
    expect(result?.needs_clarification).toBe(true);
    expect(result?.clarification_question).toContain('What start time');
  });

  it('creates a complete parsed action when title, date, and time are present', () => {
    const result = parseCalendarActionRuleBased({
      text: 'Previous user context:\nuser: create the event please\n\nLatest user request: Test for Google 123 for today at 20:00',
      nowIso: '2026-05-01T23:14:05.000Z',
      timezone: 'America/Sao_Paulo',
    });

    expect(result?.intent).toBe('create');
    expect(result?.needs_clarification).toBe(false);
    expect(result?.title).toBe('Test for Google 123');
    expect(result?.start_at).toBe('2026-05-01T23:00:00.000Z');
    expect(result?.end_at).toBe('2026-05-02T00:00:00.000Z');
  });

  it('carries title and date from previous user replies when the latest reply only gives time', () => {
    const result = parseCalendarActionRuleBased({
      text: [
        'Previous user context:',
        'user: create the event please',
        'user: Test for Google 123 for today',
        '',
        'Latest user request: 20:00',
      ].join('\n'),
      nowIso: '2026-05-01T23:14:05.000Z',
      timezone: 'America/Sao_Paulo',
    });

    expect(result?.intent).toBe('create');
    expect(result?.needs_clarification).toBe(false);
    expect(result?.title).toBe('Test for Google 123');
    expect(result?.start_at).toBe('2026-05-01T23:00:00.000Z');
  });

  it('ignores non-create calendar text', () => {
    const result = parseCalendarActionRuleBased({
      text: 'Latest user request: show my calendar today',
      nowIso: '2026-05-01T23:14:05.000Z',
      timezone: 'America/Sao_Paulo',
    });

    expect(result).toBeNull();
  });
});
