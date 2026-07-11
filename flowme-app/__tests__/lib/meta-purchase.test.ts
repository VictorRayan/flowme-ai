import { sendPublicCheckoutPurchase } from '@/lib/meta/purchase';
import { sendMetaEvent } from '@/lib/meta/conversions-api';

jest.mock('@/lib/meta/conversions-api', () => ({
  sendMetaEvent: jest.fn().mockResolvedValue(undefined),
}));

const sendMetaEventMock = sendMetaEvent as jest.MockedFunction<typeof sendMetaEvent>;

function adminReturning(session: any) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: session, error: null });
  const chain: any = { select: () => chain, eq: () => chain, maybeSingle };
  return { from: jest.fn().mockReturnValue(chain) };
}

describe('sendPublicCheckoutPurchase', () => {
  beforeEach(() => sendMetaEventMock.mockClear());

  it('sends a Purchase with a deterministic event_id and mapped fields', async () => {
    const admin = adminReturning({
      id: 'sess-123',
      email: 'buyer@example.com',
      phone: '+5511999999999',
      phone_e164: '+5511999999999',
      amount_cents: 5990,
      currency: 'BRL',
      meta_external_id: 'visitor-9',
      metadata: { meta_fbp: 'fb.1.1.p', meta_fbc: 'fb.1.1.c' },
    });

    await sendPublicCheckoutPurchase(admin as any, 'sess-123');

    expect(sendMetaEventMock).toHaveBeenCalledTimes(1);
    expect(sendMetaEventMock.mock.calls[0][0]).toMatchObject({
      event_name: 'Purchase',
      event_id: 'purchase_sess-123',
      external_id: 'visitor-9',
      email: 'buyer@example.com',
      phone: '+5511999999999',
      fbp: 'fb.1.1.p',
      fbc: 'fb.1.1.c',
      value: 59.9,
      currency: 'BRL',
    });
  });

  it('does nothing when the session is not found', async () => {
    const admin = adminReturning(null);
    await sendPublicCheckoutPurchase(admin as any, 'missing');
    expect(sendMetaEventMock).not.toHaveBeenCalled();
  });
});
