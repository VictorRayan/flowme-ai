import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/people/route';

const MOCK_PERSON = { id: 'person-1', name: 'Leticia', email: 'leticia@example.com' };

function makeChain(listData: any[] = [MOCK_PERSON], singleData: any = MOCK_PERSON) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'ilike', 'upsert', 'insert', 'update', 'or', 'gte', 'lte'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('GET /api/people', () => {
  it('returns an array of people', async () => {
    const req = new NextRequest('http://localhost/api/people');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('accepts a search query param', async () => {
    const req = new NextRequest('http://localhost/api/people?q=Leticia');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/people', () => {
  it('creates a person and returns 201', async () => {
    const req = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({ name: 'Leticia', email: 'leticia@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Leticia');
  });

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({ email: 'noname@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('creates person without email', async () => {
    const req = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({ name: 'Anonymous' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
