import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/v1/keys/route';

// Mock supabase-js createClient (used for service-role admin operations in POST)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'key-1',
        name: 'My key',
        key_prefix: 'fm_ABC12345',
        scopes: ['notes.read'],
        expires_at: null,
        created_at: '2026-05-01T00:00:00Z',
      },
      error: null,
    }),
  })),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() => {
    const sb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockReturnThis(),
    };
    return Promise.resolve({ user: { id: 'user-1', email: 'user@example.com' }, supabase: sb });
  }),
}));

describe('GET /api/v1/keys', () => {
  it('returns keys list with ok:true', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.keys)).toBe(true);
  });
});

describe('POST /api/v1/keys', () => {
  it('creates a key and returns raw_key once', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'My key', scopes: ['notes.read'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key.raw_key).toMatch(/^fm_/);
    expect(body.warning).toBeDefined();
  });

  it('returns VALIDATION_ERROR when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ scopes: ['notes.read'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when scopes is empty', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'My key', scopes: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for an invalid scope', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'My key', scopes: ['invalid.scope'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts wildcard scope *', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Admin key', scopes: ['*'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('sets expiry when expires_in_days is provided', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Short key', scopes: ['notes.read'], expires_in_days: 30 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe('DELETE /api/v1/keys', () => {
  it('deactivates a key and returns deactivated:true', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'DELETE',
      body: JSON.stringify({ key_id: 'key-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deactivated).toBe(true);
  });

  it('returns VALIDATION_ERROR when key_id is missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/keys', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
