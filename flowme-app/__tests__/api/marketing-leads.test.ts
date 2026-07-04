import { NextRequest } from 'next/server';
import { POST as POST_LEAD } from '@/app/api/marketing/leads/route';
import { POST as POST_VISIT } from '@/app/api/marketing/visits/route';
import { createMarketingCsrfToken } from '@/lib/marketing/security';

const insertSingle = jest.fn();
const insert = jest.fn(() => ({ select: jest.fn(() => ({ single: insertSingle })) }));
const mockAdmin = { from: jest.fn(() => ({ insert })) };

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => mockAdmin) }));

function req(path: string, body: Record<string, unknown>, token: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://flow-me.online',
      'content-type': 'application/json',
      'x-flowme-csrf': token,
      'user-agent': 'jest',
    },
    body: JSON.stringify(body),
  });
}

describe('marketing public endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MARKETING_ALLOWED_ORIGINS = 'https://flow-me.online';
    process.env.MARKETING_CSRF_SECRET = 'test-secret';
    insertSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null });
  });

  it('records a lead after validating CSRF and fields', async () => {
    const token = createMarketingCsrfToken('https://flow-me.online');
    const response = await POST_LEAD(req('/api/marketing/leads', {
      locale: 'pt-BR',
      name: 'Victor Rayan',
      email: 'victor@example.com',
      phone: '(11) 99999-9999',
      path: '/pt-br',
      interval: 'monthly',
    }, token));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.lead_token).toEqual(expect.any(String));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'pt-BR',
      email: 'victor@example.com',
      interest: 'price_unlocked',
      phone_e164: '+5511999999999',
      metadata: expect.objectContaining({ billing_interval: 'monthly' }),
    }));
  });

  it('preserves international lead phone numbers', async () => {
    const token = createMarketingCsrfToken('https://flow-me.online');
    const response = await POST_LEAD(req('/api/marketing/leads', {
      locale: 'pt-BR',
      name: 'Victor Rayan',
      email: 'victor@example.com',
      phone: '+1 (415) 555-2671',
      path: '/pt-br',
      interval: 'annual',
    }, token));

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+1 (415) 555-2671',
      phone_e164: '+14155552671',
    }));
  });

  it('rejects invalid lead data', async () => {
    const token = createMarketingCsrfToken('https://flow-me.online');
    const response = await POST_LEAD(req('/api/marketing/leads', { locale: 'pt-BR', name: 'V', email: 'bad', phone: '1', path: '/pt-br' }, token));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('records a landing visit', async () => {
    const token = createMarketingCsrfToken('https://flow-me.online');
    const response = await POST_VISIT(req('/api/marketing/visits', { locale: 'en-US', surface: 'landing', path: '/en-us' }, token));
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en-US', surface: 'landing', path: '/en-us' }));
  });
});
