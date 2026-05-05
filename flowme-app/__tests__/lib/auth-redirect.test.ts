import { getAppBaseUrl, getAuthCallbackUrl } from '@/lib/auth/redirect';

describe('auth redirect helpers', () => {
  it('uses the configured app URL when present', () => {
    expect(getAuthCallbackUrl('https://app.flow-me.online', 'http://localhost:3000')).toBe(
      'https://app.flow-me.online/auth/callback'
    );
  });

  it('falls back to the current origin when no app URL is configured', () => {
    expect(getAuthCallbackUrl(undefined, 'http://localhost:3000')).toBe(
      'http://localhost:3000/auth/callback'
    );
  });

  it('removes trailing slashes from the base URL', () => {
    expect(getAppBaseUrl('https://app.flow-me.online///', 'http://localhost:3000')).toBe(
      'https://app.flow-me.online'
    );
  });
});
