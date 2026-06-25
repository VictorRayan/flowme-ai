import { NextRequest } from 'next/server';
import { detectsCancellationIntent, POST } from '@/app/api/support/chat/route';

const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn();

function makeChain() {
  const chain: any = {};
  for (const method of ['select', 'eq', 'gt', 'order', 'limit', 'update', 'insert']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = mockMaybeSingle;
  chain.single = jest.fn().mockResolvedValue({ data: { id: 'funnel-1' }, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })) }));

describe('POST /api/support/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(makeChain());
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { plan_code: 'pro', billing_provider: 'stripe', status: 'active' }, error: null });
  });

  it('returns a KB answer with billing context and source keys', async () => {
    const request = new NextRequest('http://localhost/api/support/chat', {
      method: 'POST', body: JSON.stringify({ message: 'Como funciona meu pagamento?' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.answer).toContain('plano PRO');
    expect(body.sources).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'billing' })]));
    expect(body.can_escalate).toBe(true);
  });

  it.each(['', 'a'])('rejects an invalid message: %p', async message => {
    const request = new NextRequest('http://localhost/api/support/chat', {
      method: 'POST', body: JSON.stringify({ message }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(['quero cancelar', 'não quero mais pagar', 'unsubscribe', 'cancel subscription'])(
    'detects cancellation intent in %p', message => {
      expect(detectsCancellationIntent(message)).toBe(true);
    },
  );

  it('routes free-form cancellation text into the guided support funnel', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { plan_code: 'pro', billing_provider: 'stripe', status: 'active' }, error: null });
    const request = new NextRequest('http://localhost/api/support/chat', {
      method: 'POST', body: JSON.stringify({ message: 'quero cancelar minha assinatura' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.intent).toBe('cancel_subscription');
    expect(body.funnel_stage).toBe('manage_subscription');
    expect(body.next_actions).toEqual(['payment_and_recurrence']);
  });
});
