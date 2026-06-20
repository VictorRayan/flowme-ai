import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/connectors/route';
import { PATCH, DELETE } from '@/app/api/connectors/[id]/route';
import { POST as CONNECT } from '@/app/api/connectors/[id]/connect/route';
import { POST as DISCONNECT } from '@/app/api/connectors/[id]/disconnect/route';
import { requireAuth } from '@/lib/api/auth';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';

const MOCK_CONNECTOR = {
  id: 'conn-1',
  name: 'Work email',
  type: 'gmail',
  is_active: true,
  config: {},
  created_at: '2026-05-01T00:00:00Z',
};

let lastChain: any;

function makeChain(listData: any[] = [MOCK_CONNECTOR], singleData: any = MOCK_CONNECTOR) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'or', 'ilike'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  lastChain = chain;
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({})),
}));

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';

    constructor(feature: string) {
      super('Feature requires Flow Me Pro');
      this.name = 'FeatureLockedError';
      this.feature = feature;
    }
  }

  return {
    FeatureLockedError,
    requireFeature: jest.fn().mockResolvedValue({ features: { connectors: true } }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, supabase: makeChain() });
  (requireFeature as jest.Mock).mockResolvedValue({ features: { connectors: true } });
});

describe('GET /api/connectors', () => {
  it('returns connector list with ok:true', async () => {
    const req = new NextRequest('http://localhost/api/connectors');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.connectors)).toBe(true);
  });

  it('returns FEATURE_LOCKED for Free users', async () => {
    (requireFeature as jest.Mock).mockRejectedValueOnce(new FeatureLockedError('connectors' as any));

    const res = await GET(new NextRequest('http://localhost/api/connectors'));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error.code).toBe('FEATURE_LOCKED');
    expect(body.required_plan).toBe('pro');
    expect(body.feature_key).toBe('connectors');
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

  it('does not store file-specific Google URLs or IDs for account-wide connectors', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Google Docs',
        type: 'google_docs',
        config: { document_id: 'doc-1', folder_id: 'folder-1' },
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(lastChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Google Docs',
      type: 'google_docs',
      config: {},
    }));
  });
});

describe('PATCH /api/connectors/[id]', () => {
  it('returns FEATURE_LOCKED for Free users', async () => {
    (requireFeature as jest.Mock).mockRejectedValueOnce(new FeatureLockedError('connectors' as any));

    const res = await PATCH(new NextRequest('http://localhost/api/connectors/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Personal email' }),
    }), { params: Promise.resolve({ id: 'conn-1' }) });

    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe('FEATURE_LOCKED');
  });

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

describe('POST /api/connectors/[id]/connect', () => {
  function makeMaybeChain(data: any) {
    const chain: any = {};
    ['select', 'eq', 'order', 'limit'].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.maybeSingle = jest.fn().mockResolvedValue({ data, error: null });
    return chain;
  }

  function makeInsertChain(data: any) {
    const chain: any = {};
    ['insert', 'select'].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.single = jest.fn().mockResolvedValue({ data, error: null });
    return chain;
  }

  it('returns FEATURE_LOCKED for Free users', async () => {
    (requireFeature as jest.Mock).mockRejectedValueOnce(new FeatureLockedError('connectors' as any));

    const res = await CONNECT(new NextRequest('http://localhost/api/connectors/conn-1/connect', { method: 'POST' }), {
      params: Promise.resolve({ id: 'conn-1' }),
    });

    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe('FEATURE_LOCKED');
  });

  it('reuses an existing Google linked account instead of creating a duplicate placeholder', async () => {
    const connector = {
      id: 'conn-sheets',
      name: 'Google Sheets',
      type: 'google_sheets',
      config: {},
    };
    const connectorChain = makeMaybeChain(connector);
    const reusableAccountChain = makeMaybeChain({ id: 'acc-google-1' });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'connectors') return connectorChain;
        if (table === 'linked_accounts') return reusableAccountChain;
        return makeMaybeChain(null);
      }),
    };
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1' }, supabase });

    const res = await CONNECT(new NextRequest('http://localhost/api/connectors/conn-sheets/connect', { method: 'POST' }), {
      params: Promise.resolve({ id: 'conn-sheets' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirect_url).toContain('linked_account_id=acc-google-1');
    expect(body.redirect_url).toContain('connector_id=conn-sheets');
  });

  it('creates a unique linked account placeholder only when no Google account exists', async () => {
    const connector = {
      id: 'conn-drive',
      name: 'Google Drive',
      type: 'google_drive',
      config: {},
    };
    const chains = {
      connectors: [makeMaybeChain(connector)],
      linked_accounts: [
        makeMaybeChain(null),
        makeInsertChain({ id: 'new-acc-1' }),
      ],
    };
    const insertChain = chains.linked_accounts[1];
    const supabase = {
      from: jest.fn((table: keyof typeof chains) => chains[table].shift()),
    };
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1' }, supabase });

    const res = await CONNECT(new NextRequest('http://localhost/api/connectors/conn-drive/connect', { method: 'POST' }), {
      params: Promise.resolve({ id: 'conn-drive' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirect_url).toContain('linked_account_id=new-acc-1');
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringContaining('conn-dri'),
      provider: 'google',
      is_active: false,
    }));
  });
});

describe('POST /api/connectors/[id]/disconnect', () => {
  it('returns FEATURE_LOCKED for Free users', async () => {
    (requireFeature as jest.Mock).mockRejectedValueOnce(new FeatureLockedError('connectors' as any));

    const res = await DISCONNECT(new NextRequest('http://localhost/api/connectors/conn-1/disconnect', { method: 'POST' }), {
      params: Promise.resolve({ id: 'conn-1' }),
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('FEATURE_LOCKED');
    expect(body.required_plan).toBe('pro');
  });
});
