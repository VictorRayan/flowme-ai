import { NextRequest } from 'next/server';
import {
  createMarketingCsrfToken,
  isAllowedMarketingOrigin,
  marketingCorsHeaders,
  verifyMarketingCsrfToken,
} from '@/lib/marketing/security';

describe('marketing security', () => {
  beforeEach(() => {
    process.env.MARKETING_ALLOWED_ORIGINS = 'https://flow-me.online,http://localhost:4173';
    process.env.MARKETING_CSRF_SECRET = 'test-secret';
  });

  it('allows configured origins and returns CORS headers', () => {
    expect(isAllowedMarketingOrigin('https://flow-me.online')).toBe(true);
    expect(isAllowedMarketingOrigin('https://evil.test')).toBe(false);
    expect(marketingCorsHeaders('https://flow-me.online')).toEqual(expect.objectContaining({
      'Access-Control-Allow-Origin': 'https://flow-me.online',
    }));
  });

  it('creates and verifies signed origin-bound tokens', () => {
    const token = createMarketingCsrfToken('https://flow-me.online', 1000);
    expect(verifyMarketingCsrfToken(token, 'https://flow-me.online', 2000)).toBe(true);
    expect(verifyMarketingCsrfToken(token, 'http://localhost:4173', 2000)).toBe(false);
    expect(verifyMarketingCsrfToken(token, 'https://flow-me.online', 20 * 60 * 1000)).toBe(false);
  });
});
