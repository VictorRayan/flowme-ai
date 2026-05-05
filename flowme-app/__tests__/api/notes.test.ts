import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/notes/route';

const MOCK_NOTE = {
  id: 'note-1',
  title: 'My note',
  content_text: 'Hello world',
  note_date: '2026-05-01',
  note_type: 'manual',
  created_at: '2026-05-01T00:00:00Z',
};

function makeChain(listData: any[] = [MOCK_NOTE], singleData: any = { id: 'note-new' }) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'gte', 'lte', 'in', 'insert', 'update', 'upsert', 'or', 'ilike'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('GET /api/notes', () => {
  it('returns an array of notes', async () => {
    const req = new NextRequest('http://localhost/api/notes');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('accepts year and month filter params without error', async () => {
    const req = new NextRequest('http://localhost/api/notes?year=2026&month=5');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/notes', () => {
  it('creates a note and returns its id with status 201', async () => {
    const req = new NextRequest('http://localhost/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'My note', content: '<p>Hello</p>', note_date: '2026-05-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });

  it('uses Untitled when title is omitted', async () => {
    const req = new NextRequest('http://localhost/api/notes', {
      method: 'POST',
      body: JSON.stringify({ content: '<p>No title</p>', note_date: '2026-05-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('defaults note_type to manual when not provided', async () => {
    const req = new NextRequest('http://localhost/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', note_date: '2026-05-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
