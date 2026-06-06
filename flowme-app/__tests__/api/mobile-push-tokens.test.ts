import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/mobile/push-tokens/route';

const upsert = jest.fn().mockResolvedValue({ error: null });
const update = jest.fn();
const eq = jest.fn();

function makeSupabase() {
  const chain: any = {
    update,
    eq,
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: null, error: null }).then(resolve as any, reject as any);
    },
  };
  update.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  return {
    from: jest.fn((table: string) => {
      if (table === 'mobile_push_tokens') {
        return { upsert, update };
      }
      return chain;
    }),
  };
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeSupabase() })
  ),
}));

describe('POST /api/mobile/push-tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
  });

  it('registers an Android FCM token', async () => {
    const req = new NextRequest('http://localhost/api/mobile/push-tokens', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'android',
        provider: 'fcm',
        device_token: 'fcm-token-1234567890',
        device_id: 'device-1',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, registered: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      platform: 'android',
      provider: 'fcm',
      device_token: 'fcm-token-1234567890',
      enabled: true,
    }), { onConflict: 'user_id,provider,device_token' });
  });

  it('rejects invalid provider/platform pairs', async () => {
    const req = new NextRequest('http://localhost/api/mobile/push-tokens', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'ios',
        provider: 'fcm',
        device_token: 'token-1234567890123456',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/mobile/push-tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft deletes a mobile push token by provider and token', async () => {
    const req = new NextRequest('http://localhost/api/mobile/push-tokens?provider=fcm&device_token=fcm-token-1234567890', {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, deleted: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq).toHaveBeenCalledWith('provider', 'fcm');
    expect(eq).toHaveBeenCalledWith('device_token', 'fcm-token-1234567890');
  });
});
