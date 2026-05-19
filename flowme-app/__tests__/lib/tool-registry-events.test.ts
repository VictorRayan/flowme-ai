import { getActiveToolDomains, getToolByName } from '@/lib/ai/tools/registry';

describe('tool registry event domain', () => {
  it('exposes only Google Calendar tools for event creation', () => {
    expect(getToolByName('events.list')).toBeUndefined();
    expect(getToolByName('events.create')).toBeUndefined();
    expect(getToolByName('events.delete')).toBeUndefined();
    expect(getToolByName('calendar.create_event')).toBeDefined();
    expect(getToolByName('microactivities.list')).toBeUndefined();
    expect(getActiveToolDomains()).toContain('calendar');
    expect(getActiveToolDomains()).not.toContain('events');
    expect(getActiveToolDomains()).not.toContain('microactivities');
  });
});
