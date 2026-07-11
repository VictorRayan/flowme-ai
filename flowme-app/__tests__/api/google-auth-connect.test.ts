import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/google/connect/route';
import { requireAuth } from '@/lib/api/auth';

const mockGenerateAuthUrl = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/google/google-auth', () => ({
  getGoogleOAuthClient: () => ({
    generateAuthUrl: mockGenerateAuthUrl,
  }),
}));

type ConnectorType = 'gmail' | 'google_docs' | 'google_sheets' | 'google_drive';

function makeSupabase(connectorType?: ConnectorType) {
  return {
    from: jest.fn((table: string) => {
      const chain: any = {};
      ['select', 'eq'].forEach((method) => {
        chain[method] = jest.fn().mockReturnValue(chain);
      });
      chain.single = jest.fn().mockResolvedValue({ data: { id: 'linked-1', user_id: 'user-1' }, error: null });
      chain.maybeSingle = jest.fn().mockResolvedValue({
        data: table === 'connectors' && connectorType ? { id: 'conn-1', type: connectorType } : null,
        error: null,
      });
      return chain;
    }),
  };
}

function scopeFromLastAuthUrl(): string[] {
  const scope = mockGenerateAuthUrl.mock.calls.at(-1)?.[0]?.scope;
  return Array.isArray(scope) ? scope : [];
}

describe('Google OAuth connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.test/oauth');
  });

  it('requests only Calendar scopes when connecting a linked Google Calendar account', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: makeSupabase(),
    });

    const response = await GET(new NextRequest('http://localhost/api/auth/google/connect?linked_account_id=linked-1'));

    expect(response.status).toBe(307);
    expect(scopeFromLastAuthUrl()).toEqual([
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ]);
  });

  it('requests only Gmail scopes for a Gmail connector', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: makeSupabase('gmail'),
    });

    const response = await GET(new NextRequest('http://localhost/api/auth/google/connect?linked_account_id=linked-1&connector_id=conn-1'));

    expect(response.status).toBe(307);
    expect(scopeFromLastAuthUrl()).toEqual(['https://www.googleapis.com/auth/gmail.modify']);
  });

  it('requests only Docs and Drive read scopes for a Google Docs connector', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: makeSupabase('google_docs'),
    });

    const response = await GET(new NextRequest('http://localhost/api/auth/google/connect?linked_account_id=linked-1&connector_id=conn-1'));

    expect(response.status).toBe(307);
    expect(scopeFromLastAuthUrl()).toEqual([
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.readonly',
    ]);
  });
});
