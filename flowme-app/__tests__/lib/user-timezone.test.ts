import { isValidTimezone, resolveUserTimezone } from '@/lib/timezones/user-timezone';

function timezoneClient(timezone: string | null, rejects = false) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: rejects
      ? jest.fn().mockRejectedValue(new Error('database unavailable'))
      : jest.fn().mockResolvedValue({ data: { briefing_timezone: timezone }, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: jest.fn().mockReturnValue(query) };
}

describe('user timezone resolution', () => {
  it('prefers the timezone stored in the user profile', async () => {
    await expect(resolveUserTimezone(timezoneClient('America/Sao_Paulo'), 'user-1', 'Europe/London'))
      .resolves.toBe('America/Sao_Paulo');
  });

  it('falls back to a valid request timezone when the profile is empty', async () => {
    await expect(resolveUserTimezone(timezoneClient(null), 'user-1', 'Europe/London'))
      .resolves.toBe('Europe/London');
  });

  it('falls back to UTC when profile lookup and fallback are unavailable', async () => {
    await expect(resolveUserTimezone(timezoneClient(null, true), 'user-1', 'Not/A_Timezone'))
      .resolves.toBe('UTC');
  });

  it('validates IANA timezone names', () => {
    expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimezone('Not/A_Timezone')).toBe(false);
  });
});
