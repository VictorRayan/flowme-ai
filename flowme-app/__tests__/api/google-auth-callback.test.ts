const mockGetToken = jest.fn();
const mockCreateServerClient = jest.fn();

jest.mock('@/lib/google/google-auth', () => ({
  getGoogleOAuthClient: () => ({
    getToken: mockGetToken,
  }),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue({ value: 'session-cookie' }),
  }),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/google/callback/route';

function makeChain(table: string, chains: Record<string, any[]>) {
  const chain: any = {
    table,
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: null, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: null, error: null }).catch(reject as any);
    },
  };
  ['select', 'eq', 'upsert', 'update'].forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: { id: 'linked-1' }, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'linked-1' }, error: null });
  chains[table] = [...(chains[table] || []), chain];
  return chain;
}

describe('Google OAuth callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600 * 1000,
      },
    });
  });

  it('stores tokens, activates the linked account, and links the connector', async () => {
    const chains: Record<string, any[]> = {};
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn((table: string) => makeChain(table, chains)),
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const state = Buffer.from(JSON.stringify({
      user_id: 'user-1',
      linked_account_id: 'linked-1',
      connector_id: 'conn-1',
      return_to: '/app/connectors',
    })).toString('base64');

    const response = await GET(new NextRequest(
      `http://localhost/api/auth/google/callback?code=code-1&state=${encodeURIComponent(state)}`,
    ));

    expect(response.headers.get('location')).toBe('http://localhost:3000/app/connectors?connector_connected=conn-1');

    expect(chains.user_google_tokens[0].upsert).toHaveBeenCalledWith(expect.objectContaining({
      linked_account_id: 'linked-1',
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }), { onConflict: 'linked_account_id' });

    const linkedAccountUpdate = chains.linked_accounts.find((chain) => chain.update.mock.calls.length > 0);
    expect(linkedAccountUpdate.update).toHaveBeenCalledWith({ is_active: true });

    expect(chains.connectors[0].update).toHaveBeenCalledWith({
      config: { linked_account_id: 'linked-1' },
      is_active: true,
    });
  });
});
