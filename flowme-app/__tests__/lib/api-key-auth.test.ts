import { generateApiKey } from '@/lib/api/api-key-auth';
import * as nodeCrypto from 'node:crypto';
import { NextRequest } from 'next/server';

jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});

// Mock Supabase createClient — we test scope / format logic, not the DB
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'key-id',
        user_id: 'user-id',
        name: 'Test Key',
        scopes: ['notes.read', 'calendar.read'],
        is_active: true,
        expires_at: null,
      },
      error: null,
    }),
    update: jest.fn().mockReturnThis(),
    then: jest.fn(),
  })),
}));

describe('generateApiKey', () => {
  it('starts with fm_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('fm_')).toBe(true);
  });

  it('has total length of 51 chars (fm_ + 48)', () => {
    const key = generateApiKey();
    expect(key.length).toBe(51);
  });

  it('generates unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateApiKey()));
    expect(keys.size).toBe(20);
  });

  it('only contains alphanumeric chars after the prefix', () => {
    const key = generateApiKey();
    const suffix = key.slice(3);
    expect(/^[A-Za-z0-9]+$/.test(suffix)).toBe(true);
  });

  it('uses cryptographic random bytes', () => {
    const randomBytes = nodeCrypto.randomBytes as jest.Mock;
    randomBytes.mockClear();
    generateApiKey();
    expect(randomBytes).toHaveBeenCalled();
  });
});

describe('requireApiKeyAuth', () => {
  // Import after mocks are established
  let requireApiKeyAuth: typeof import('@/lib/api/api-key-auth').requireApiKeyAuth;

  beforeAll(async () => {
    ({ requireApiKeyAuth } = await import('@/lib/api/api-key-auth'));
  });

  function makeRequest(authHeader?: string) {
    return new NextRequest('http://localhost/api/v1/notes', {
      headers: authHeader ? { authorization: authHeader } : {},
    });
  }

  it('returns 401 when Authorization header is missing', async () => {
    const result = await requireApiKeyAuth(makeRequest());
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when key does not start with fm_', async () => {
    const result = await requireApiKeyAuth(makeRequest('Bearer invalid_key_here'));
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Bearer prefix is missing', async () => {
    const result = await requireApiKeyAuth(makeRequest('fm_abc123'));
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns auth result for valid key with sufficient scopes', async () => {
    const key = generateApiKey(); // starts with fm_
    const result = await requireApiKeyAuth(makeRequest(`Bearer ${key}`), ['notes.read']);
    // The mock returns scopes: ['notes.read', 'calendar.read'] so this should pass
    expect(result).not.toBeInstanceOf(Response);
    const auth = result as any;
    expect(auth.userId).toBe('user-id');
    expect(auth.scopes).toContain('notes.read');
  });
});
