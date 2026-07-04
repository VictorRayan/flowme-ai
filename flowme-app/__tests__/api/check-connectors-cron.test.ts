import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/check-connectors/route';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { sendText } from '@/lib/whatsapp/evolution-client';

const mockGetValidGoogleToken = jest.fn();
const mockDriveFilesList = jest.fn();

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/lib/whatsapp/evolution-client', () => ({
  sendText: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/google/google-auth', () => ({
  getValidGoogleToken: (...args: unknown[]) => mockGetValidGoogleToken(...args),
}));

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({ files: { list: mockDriveFilesList } })),
    gmail: jest.fn(() => ({ users: { getProfile: jest.fn() } })),
  },
}));

function makeAdmin() {
  const connectors = [{
    id: 'conn-drive',
    user_id: 'user-1',
    name: 'Google Drive',
    type: 'google_drive',
    is_active: true,
    config: { linked_account_id: 'linked-1' },
    created_at: '2026-05-01T00:00:00Z',
  }];
  const channel = { phone: '5511999999999' };
  const updateChain: any = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  const connectorSelect: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: connectors, error: null }),
  };
  const channelSelect: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: channel, error: null }),
  };
  const admin = {
    updateChain,
    from: jest.fn((table: string) => {
      if (table === 'whatsapp_channels') return channelSelect;
      if (table === 'connectors' && admin.from.mock.calls.filter(([name]: [string]) => name === 'connectors').length > 1) return updateChain;
      return connectorSelect;
    }),
  };
  return admin;
}

describe('GET /api/cron/check-connectors', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv, CRON_SECRET: 'secret', NEXT_PUBLIC_APP_URL: 'https://app.flow-me.online' };
    mockGetValidGoogleToken.mockResolvedValue({ kind: 'oauth-client' });
    mockDriveFilesList.mockRejectedValue({ response: { status: 403, data: { error: { message: 'insufficient authentication scopes' } } } });
    (getSupabaseAdmin as jest.Mock).mockReturnValue(makeAdmin());
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it('requires cron authorization', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/check-connectors'));
    expect(res.status).toBe(401);
  });

  it('notifies WhatsApp when a Google connector needs reconnect', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/check-connectors', {
      headers: { authorization: 'Bearer secret' },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, checked: 1, needs_reconnect: 1, notified: 1 });
    expect(sendText).toHaveBeenCalledWith('5511999999999', expect.stringContaining('https://app.flow-me.online/app/connectors'));
  });
});
