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
      method: 'POST', body: JSON.stringify({ message: 'Como funcionam os créditos de IA?' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.answer).toContain('plano PRO');
    expect(body.sources).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'credits' })]));
    expect(body.can_escalate).toBe(false);
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
    mockMaybeSingle.mockReset();
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

  it('opens billing support review for payment problems', async () => {
    mockMaybeSingle.mockReset();
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { plan_code: 'pro', billing_provider: 'stripe', status: 'active' }, error: null });
    const request = new NextRequest('http://localhost/api/support/chat', {
      method: 'POST', body: JSON.stringify({ message: 'I have a payment problem', locale: 'en-US' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.intent).toBe('payment_support');
    expect(body.answer).toContain('register this correctly');
    expect(body.can_escalate).toBe(true);
    expect(body.request_form_available).toBe(true);
    expect(body.suggested_request_category).toBe('payment');
  });

  it('lets a previous subscription quick action recover an advanced cancellation session', async () => {
    mockMaybeSingle.mockReset();
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'funnel-1', current_stage: 'cancel_subscription', completed_stages: ['manage_subscription', 'payment_and_recurrence', 'cancel_subscription'], expires_at: '2099-01-01T00:00:00.000Z' }, error: null })
      .mockResolvedValueOnce({ data: { plan_code: 'pro', billing_provider: 'stripe', status: 'active' }, error: null });
    const request = new NextRequest('http://localhost/api/support/chat', {
      method: 'POST', body: JSON.stringify({ question_key: 'manage_subscription', locale: 'en-US' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.funnel_stage).toBe('cancel_subscription');
    expect(body.cancellation_form_available).toBe(true);
  });
});
