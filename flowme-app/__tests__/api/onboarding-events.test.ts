import { NextRequest } from 'next/server';
import { POST } from '@/app/api/onboarding/events/route';

const insert = jest.fn();
const mockRequireAuth = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

function supabase() {
  return {
    from: jest.fn(() => ({ insert })),
  };
}

describe('POST /api/onboarding/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    mockRequireAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
      supabase: supabase(),
    });
  });

  it('records an onboarding step event', async () => {
    const response = await POST(new NextRequest('http://localhost/api/onboarding/events', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'step_viewed', step_key: 'whatsapp', step_index: 5, locale: 'pt-BR', session_id: 'session-1' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recorded).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      email: 'user@example.com',
      event_type: 'step_viewed',
      step_key: 'whatsapp',
      step_index: 5,
      locale: 'pt-BR',
      session_id: 'session-1',
    }));
  });

  it('rejects invalid event data', async () => {
    const response = await POST(new NextRequest('http://localhost/api/onboarding/events', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'bad', step_key: '' }),
    }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
