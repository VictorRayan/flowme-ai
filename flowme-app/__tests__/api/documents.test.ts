import { NextRequest } from 'next/server';
import { GET } from '@/app/api/documents/route';

const MOCK_DOC = {
  id: 'doc-1',
  filename: 'report.pdf',
  mime_type: 'application/pdf',
  file_size: 1024,
  summary: 'A quarterly report',
  tags: ['finance'],
  processing_status: 'completed',
  created_at: '2026-05-01T00:00:00Z',
};

function makeChain(listData: any[] = [MOCK_DOC]) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'range', 'or', 'contains', 'ilike', 'gte', 'lte'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: MOCK_DOC, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('GET /api/documents', () => {
  it('returns document list with ok:true', async () => {
    const req = new NextRequest('http://localhost/api/documents');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.documents)).toBe(true);
  });

  it('returns count, offset and limit in response', async () => {
    const req = new NextRequest('http://localhost/api/documents');
    const res = await GET(req);
    const body = await res.json();
    expect(typeof body.count).toBe('number');
    expect(typeof body.offset).toBe('number');
    expect(typeof body.limit).toBe('number');
  });

  it('caps limit at 100 regardless of query param', async () => {
    const req = new NextRequest('http://localhost/api/documents?limit=9999');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBeLessThanOrEqual(100);
  });

  it('accepts search param without error', async () => {
    const req = new NextRequest('http://localhost/api/documents?search=quarterly');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('accepts status filter param', async () => {
    const req = new NextRequest('http://localhost/api/documents?status=completed');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
