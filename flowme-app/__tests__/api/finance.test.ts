import { NextRequest } from 'next/server';
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/finance/profile/route';
import { GET as getTransactions, POST as postTransaction } from '@/app/api/finance/transactions/route';
import { DELETE, PATCH } from '@/app/api/finance/transactions/[id]/route';
import { GET as getSummary } from '@/app/api/finance/summary/route';

const transaction = {
  id: 'txn-1',
  user_id: 'user-1',
  type: 'expense',
  amount: 42,
  currency: 'BRL',
  converted_amount: null,
  converted_currency: null,
  exchange_rate: null,
  occurred_on: '2026-06-03',
  category_id: null,
  category_name: 'alimentação',
  merchant: null,
  description: 'almoço',
  payment_method: null,
  source: 'web',
  raw_text: null,
  confidence: null,
  status: 'confirmed',
};

function makeChain() {
  let table = '';
  const chain: any = {
    then(resolve: Function, reject: Function) {
      const data = table === 'financial_transactions' ? [transaction] : [];
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: [], error: null }).catch(reject as any);
    },
  };
  const methods = ['select', 'eq', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'upsert', 'or', 'contains', 'ilike', 'gte', 'lte', 'in'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.from = jest.fn((name: string) => {
    table = name;
    return chain;
  });
  chain.single = jest.fn().mockImplementation(() => Promise.resolve({
    data: table === 'financial_profiles'
      ? { user_id: 'user-1', default_currency: 'BRL', monthly_income_target: null, monthly_investment_target: null, emergency_reserve_target: null, main_financial_objective: null, risk_profile: null }
      : transaction,
    error: null,
  }));
  chain.maybeSingle = jest.fn().mockImplementation(() => Promise.resolve({
    data: table === 'financial_profiles'
      ? { user_id: 'user-1', default_currency: 'BRL', monthly_income_target: null, monthly_investment_target: null, emergency_reserve_target: null, main_financial_objective: null, risk_profile: null }
      : null,
    error: null,
  }));
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

const req = (url: string, body?: object, method = 'POST') => new NextRequest(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

describe('finance API', () => {
  it('gets the financial profile', async () => {
    const res = await getProfile(new NextRequest('http://localhost/api/finance/profile'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.profile.default_currency).toBe('BRL');
  });

  it('updates the financial profile currency', async () => {
    const res = await patchProfile(req('http://localhost/api/finance/profile', { default_currency: 'USD' }, 'PATCH'));
    expect(res.status).toBe(200);
  });

  it('rejects invalid profile currency', async () => {
    const res = await patchProfile(req('http://localhost/api/finance/profile', { default_currency: 'BTC' }, 'PATCH'));
    expect(res.status).toBe(400);
  });

  it('lists transactions', async () => {
    const res = await getTransactions(new NextRequest('http://localhost/api/finance/transactions?month=2026-06'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.transactions).toHaveLength(1);
  });

  it('creates a transaction', async () => {
    const res = await postTransaction(req('http://localhost/api/finance/transactions', {
      type: 'expense',
      amount: 42,
      occurred_on: '2026-06-03',
      category_name: 'alimentação',
    }));
    expect(res.status).toBe(200);
  });

  it('rejects invalid transaction amount', async () => {
    const res = await postTransaction(req('http://localhost/api/finance/transactions', {
      type: 'expense',
      amount: 0,
      occurred_on: '2026-06-03',
    }));
    expect(res.status).toBe(400);
  });

  it('updates a transaction', async () => {
    const res = await PATCH(req('http://localhost/api/finance/transactions/txn-1', { category_name: 'transporte' }, 'PATCH'), {
      params: Promise.resolve({ id: 'txn-1' }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects empty transaction patch', async () => {
    const res = await PATCH(req('http://localhost/api/finance/transactions/txn-1', {}, 'PATCH'), {
      params: Promise.resolve({ id: 'txn-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('deletes a transaction', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/finance/transactions/txn-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'txn-1' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });

  it('returns a monthly summary', async () => {
    const res = await getSummary(new NextRequest('http://localhost/api/finance/summary?month=2026-06'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.total_expenses).toBe(42);
  });
});
