export type MobilePushPlatform = 'ios' | 'android';
export type MobilePushProvider = 'apns' | 'fcm';

export interface MobilePushTokenInput {
  platform: MobilePushPlatform;
  provider: MobilePushProvider;
  device_token: string;
  device_id?: string | null;
  app_version?: string | null;
  os_version?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export interface MobilePushTokenRow extends MobilePushTokenInput {
  user_id: string;
  enabled: true;
  last_seen_at: string;
  updated_at: string;
}

const VALID_PLATFORMS = new Set(['ios', 'android']);
const VALID_PROVIDERS = new Set(['apns', 'fcm']);

function cleanOptional(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function expectedProviderForPlatform(platform: MobilePushPlatform): MobilePushProvider {
  return platform === 'ios' ? 'apns' : 'fcm';
}

export function normalizeMobilePushTokenInput(
  input: Record<string, unknown>,
  userId: string,
  nowIso = new Date().toISOString(),
): { ok: true; row: MobilePushTokenRow } | { ok: false; error: string } {
  const platform = String(input.platform || '').trim().toLowerCase();
  const provider = String(input.provider || '').trim().toLowerCase();
  const deviceToken = String(input.device_token || input.token || '').trim();

  if (!VALID_PLATFORMS.has(platform)) return { ok: false, error: 'platform must be ios or android' };
  if (!VALID_PROVIDERS.has(provider)) return { ok: false, error: 'provider must be apns or fcm' };
  if (expectedProviderForPlatform(platform as MobilePushPlatform) !== provider) {
    return { ok: false, error: 'provider does not match platform' };
  }
  if (deviceToken.length < 16 || deviceToken.length > 4096) {
    return { ok: false, error: 'device_token must be between 16 and 4096 characters' };
  }

  return {
    ok: true,
    row: {
      user_id: userId,
      platform: platform as MobilePushPlatform,
      provider: provider as MobilePushProvider,
      device_token: deviceToken,
      device_id: cleanOptional(input.device_id, 200),
      app_version: cleanOptional(input.app_version, 80),
      os_version: cleanOptional(input.os_version, 80),
      locale: cleanOptional(input.locale, 32),
      timezone: cleanOptional(input.timezone, 80),
      enabled: true,
      last_seen_at: nowIso,
      updated_at: nowIso,
    },
  };
}
