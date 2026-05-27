import { buildBriefingDelivery } from '@/lib/onboarding/briefing-delivery';

describe('buildBriefingDelivery', () => {
  it('always includes web', () => {
    expect(buildBriefingDelivery({})).toEqual(['web']);
  });

  it('adds whatsapp only when the number is linked', () => {
    expect(buildBriefingDelivery({ whatsappLinked: true })).toEqual(['web', 'whatsapp']);
    expect(buildBriefingDelivery({ whatsappLinked: false })).toEqual(['web']);
  });

  it('adds push only when permission was granted', () => {
    expect(buildBriefingDelivery({ pushGranted: true })).toEqual(['web', 'push']);
    expect(buildBriefingDelivery({ pushGranted: false })).toEqual(['web']);
  });

  it('keeps web → whatsapp → push order when all are enabled', () => {
    expect(buildBriefingDelivery({ whatsappLinked: true, pushGranted: true })).toEqual([
      'web',
      'whatsapp',
      'push',
    ]);
  });
});
