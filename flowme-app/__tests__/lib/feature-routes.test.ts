import { featureForApiPath, featureForAppPath } from '@/lib/billing/feature-routes';

describe('paid feature route map', () => {
  it.each([
    ['/api/calendar/events', 'calendar'],
    ['/api/events/event-1', 'calendar'],
    ['/api/tasks/day', 'today'],
    ['/api/goals/plan', 'goals'],
    ['/api/finance/summary', 'finance'],
    ['/api/connectors/connector-1/connect', 'connectors'],
    ['/api/weekly-reviews/latest', 'reviews'],
    ['/api/monthly-reviews/latest', 'reviews'],
    ['/api/briefings/run', 'briefings'],
    ['/api/reminders/reminder-1', 'reminders'],
    ['/api/meetings/meeting-1/audio', 'meetings'],
    ['/api/ai/images', 'images'],
    ['/api/whatsapp/channel/verify', 'whatsapp'],
  ])('maps %s to %s', (path, feature) => {
    expect(featureForApiPath(path)).toBe(feature);
  });

  it.each([
    ['/app/calendar', 'calendar'],
    ['/app/today', 'today'],
    ['/app/goals', 'goals'],
    ['/app/finance', 'finance'],
    ['/app/reviews', 'reviews'],
    ['/app/connectors', 'connectors'],
    ['/app/notes/meetings/meeting-1/recorder', 'meetings'],
  ])('protects app route %s with %s', (path, feature) => {
    expect(featureForAppPath(path)).toBe(feature);
  });

  it('keeps Free product surfaces outside paid routing', () => {
    expect(featureForApiPath('/api/notes')).toBeNull();
    expect(featureForApiPath('/api/ai/chat')).toBeNull();
    expect(featureForAppPath('/app/notes')).toBeNull();
    expect(featureForAppPath('/app/ai')).toBeNull();
    expect(featureForAppPath('/app/settings')).toBeNull();
    expect(featureForAppPath('/app/support')).toBeNull();
  });
});
