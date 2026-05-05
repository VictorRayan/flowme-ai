import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/connectors/route';
import { PATCH, DELETE } from '@/app/api/connectors/[id]/route';

const MOCK_CONNECTOR = {
  id: 'conn-1',
  name: 'Work email',
  type: 'gmail',
  is_active: true,
  config: {},
  created_at: '2026-05-01T00:00:00Z',
};

function makeChain(listData: any[] = [MOCK_CONNECTOR], singleData: any = MOCK_CONNECTOR) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'insert', 'update', 'delete', 'upsert', 'or', 'ilike'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('GET /api/connectors', () => {
  it('returns connector list with ok:true', async () => {
    const req = new NextRequest('http://localhost/api/connectors');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.connectors)).toBe(true);
  });
});

describe('POST /api/connectors', () => {
  it('creates a connector and returns it', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({ name: 'Work email', type: 'gmail' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.connector).toBeDefined();
  });

  it('returns VALIDATION_ERROR for a name that is too short', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', type: 'gmail' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for an unknown connector type', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({ name: 'My source', type: 'twitter' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts all valid connector types', async () => {
    const types = ['gmail', 'google_docs', 'google_sheets', 'google_drive'];
    for (const type of types) {
      const req = new NextRequest('http://localhost/api/connectors', {
        method: 'POST',
        body: JSON.stringify({ name: 'My source', type }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});

describe('PATCH /api/connectors/[id]', () => {
  it('renames a connector', async () => {
    const req = new NextRequest('http://localhost/api/connectors/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Personal email' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('toggles is_active', async () => {
    const req = new NextRequest('http://localhost/api/connectors/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(200);
  });

  it('returns VALIDATION_ERROR when no fields provided', async () => {
    const req = new NextRequest('http://localhost/api/connectors/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for a name too short', async () => {
    const req = new NextRequest('http://localhost/api/connectors/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/connectors/[id]', () => {
  it('deletes a connector and returns deleted:true', async () => {
    const req = new NextRequest('http://localhost/api/connectors/conn-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
  });
});
