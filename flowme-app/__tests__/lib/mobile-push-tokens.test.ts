import { expectedProviderForPlatform, normalizeMobilePushTokenInput } from '@/lib/mobile-push/tokens';

describe('mobile push token normalization', () => {
  it('maps iOS to APNs and Android to FCM', () => {
    expect(expectedProviderForPlatform('ios')).toBe('apns');
    expect(expectedProviderForPlatform('android')).toBe('fcm');
  });

  it('normalizes a valid Android FCM token', () => {
    const result = normalizeMobilePushTokenInput({
      platform: 'android',
      provider: 'fcm',
      device_token: 'fcm-token-1234567890',
      device_id: 'pixel-1',
      timezone: 'America/Sao_Paulo',
    }, 'user-1', '2026-06-06T03:00:00.000Z');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row).toEqual(expect.objectContaining({
        user_id: 'user-1',
        platform: 'android',
        provider: 'fcm',
        device_token: 'fcm-token-1234567890',
        device_id: 'pixel-1',
        enabled: true,
        last_seen_at: '2026-06-06T03:00:00.000Z',
      }));
    }
  });

  it('rejects provider/platform mismatches', () => {
    const result = normalizeMobilePushTokenInput({
      platform: 'ios',
      provider: 'fcm',
      device_token: 'token-1234567890123456',
    }, 'user-1');

    expect(result).toEqual({ ok: false, error: 'provider does not match platform' });
  });

  it('rejects short tokens', () => {
    const result = normalizeMobilePushTokenInput({
      platform: 'ios',
      provider: 'apns',
      device_token: 'short',
    }, 'user-1');

    expect(result.ok).toBe(false);
  });
});
