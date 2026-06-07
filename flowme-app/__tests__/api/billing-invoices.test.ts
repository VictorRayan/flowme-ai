import { NextRequest } from 'next/server';
import { GET } from '@/app/api/billing/invoices/route';

const mockInvoicesList = jest.fn();
const mockAdminFrom = jest.fn(() => makeChain());

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    invoices: { list: mockInvoicesList },
  })),
}));

function makeChain(subscription: any = { provider_customer_id: 'cus_123' }) {
  const chain: any = {
    select: jest.fn().mockReturnValue(undefined),
    eq: jest.fn().mockReturnValue(undefined),
    order: jest.fn().mockReturnValue(undefined),
    limit: jest.fn().mockReturnValue(undefined),
    maybeSingle: jest.fn().mockResolvedValue({ data: subscription, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: { id: 'user-1' },
      supabase: {},
    })
  ),
}));

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({ from: mockAdminFrom })),
}));

describe('GET /api/billing/invoices', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv, STRIPE_SECRET_KEY: 'sk_test_123' };
    mockInvoicesList.mockResolvedValue({
      data: [{
        id: 'in_123',
        number: 'F-001',
        status: 'paid',
        currency: 'brl',
        amount_paid: 5990,
        amount_due: 0,
        created: 1780704000,
        hosted_invoice_url: 'https://invoice.stripe.test/in_123',
        invoice_pdf: 'https://invoice.stripe.test/in_123.pdf',
      }],
    });
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('returns recent Stripe invoices for the authenticated user customer', async () => {
    const res = await GET(new NextRequest('http://localhost/api/billing/invoices'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockInvoicesList).toHaveBeenCalledWith({ customer: 'cus_123', limit: 12 });
    expect(body.invoices).toEqual([expect.objectContaining({
      id: 'in_123',
      number: 'F-001',
      currency: 'BRL',
      amount_paid: 5990,
      hosted_invoice_url: 'https://invoice.stripe.test/in_123',
    })]);
  });
});
