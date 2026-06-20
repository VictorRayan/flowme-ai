import { dispatchMobilePush } from '@/lib/mobile-push/send';

function makeAdmin(tokens: Array<Record<string, unknown>>) {
  const disable = jest.fn().mockResolvedValue({ error: null });
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnValue({ eq: disable }),
    then(resolve: Function) {
      return Promise.resolve({ data: tokens, error: null }).then(resolve as any);
    },
  };
  return { admin: { from: jest.fn().mockReturnValue(chain) } as any, disable };
}

describe('mobile push dispatch', () => {
  it('routes iOS and Android tokens through their matching adapters', async () => {
    const { admin } = makeAdmin([
      { id: 'ios-1', provider: 'apns', device_token: 'apple-token' },
      { id: 'android-1', provider: 'fcm', device_token: 'google-token' },
    ]);
    const apns = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const fcm = { send: jest.fn().mockResolvedValue({ ok: true }) };

    const result = await dispatchMobilePush(admin, 'user-1', { title: 'Oi', body: 'Teste' }, { apns, fcm });

    expect(apns.send).toHaveBeenCalledWith('apple-token', expect.objectContaining({ title: 'Oi' }));
    expect(fcm.send).toHaveBeenCalledWith('google-token', expect.objectContaining({ body: 'Teste' }));
    expect(result).toEqual({ attempted: 2, delivered: 2 });
  });

  it('disables invalid provider tokens', async () => {
    const { admin, disable } = makeAdmin([
      { id: 'ios-1', provider: 'apns', device_token: 'expired-token' },
    ]);
    const apns = { send: jest.fn().mockResolvedValue({ ok: false, invalidToken: true }) };
    const fcm = { send: jest.fn() };

    await dispatchMobilePush(admin, 'user-1', { title: 'Oi', body: 'Teste' }, { apns, fcm });

    expect(disable).toHaveBeenCalledWith('id', 'ios-1');
  });
});
