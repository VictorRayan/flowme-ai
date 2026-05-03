import { getActiveToolDomains, getToolByName } from '@/lib/ai/tools/registry';

describe('tool registry event domain', () => {
  it('exposes events tools and not the old microactivities namespace', () => {
    expect(getToolByName('events.list')).toBeDefined();
    expect(getToolByName('events.create')).toBeDefined();
    expect(getToolByName('events.delete')).toBeDefined();
    expect(getToolByName('microactivities.list')).toBeUndefined();
    expect(getActiveToolDomains()).toContain('events');
    expect(getActiveToolDomains()).not.toContain('microactivities');
  });
});
