import { NextRequest } from 'next/server';

// ---- Supabase mock ----
function makeChain(singleData: any = null) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: [], error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: [], error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'limit', 'insert', 'update',
                   'delete', 'upsert', 'or', 'maybeSingle'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

jest.mock('@/lib/whatsapp/evolution-client', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

import { GET, POST, PATCH, DELETE } from '@/app/api/whatsapp/channel/route';
import { POST as VERIFY } from '@/app/api/whatsapp/channel/verify/route';
import { requireAuth } from '@/lib/api/auth';
import { sendVerificationCode } from '@/lib/whatsapp/evolution-client';

const makeReq = (body?: object, method = 'POST') =>
  new NextRequest('http://localhost/api/whatsapp/channel', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('GET /api/whatsapp/channel', () => {
  it('returns null channel when none exists', async () => {
    const res  = await GET(new NextRequest('http://localhost/api/whatsapp/channel', { method: 'GET' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.channel).toBeNull();
  });

  it('returns channel data when found', async () => {
    const mockChannel = {
      id: 'ch-1',
      phone: '5511999999999',
      status: 'active',
      verified_at: null,
      reminders_enabled: true,
      is_default_reminder_channel: true,
      created_at: '2026-01-01',
    };
    (requireAuth as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-1' },
      supabase: makeChain(mockChannel),
    });
    const res  = await GET(new NextRequest('http://localhost/api/whatsapp/channel', { method: 'GET' }));
    const data = await res.json();
    expect(data.channel.phone).toBe('5511999999999');
    expect(data.channel.reminders_enabled).toBe(true);
  });
});

describe('POST /api/whatsapp/channel', () => {
  it('rejects missing phone', async () => {
    const res  = await POST(makeReq({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('rejects invalid phone', async () => {
    const res  = await POST(makeReq({ phone: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('rejects a plausible-looking number that is invalid for its country', async () => {
    const res = await POST(makeReq({ phone: '+1 123 456 7890' }));
    expect(res.status).toBe(400);
  });

  it('registers valid phone and sends code', async () => {
    const res  = await POST(makeReq({ phone: '+55 (11) 99122-6950', language: 'pt' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.sent).toBe(true);
    expect(data.phone).toBe('5511991226950');
    expect(sendVerificationCode).toHaveBeenCalledWith('5511991226950', expect.stringMatching(/^\d{6}$/), 'pt');
  });

  it('rejects unsupported verification message languages', async () => {
    const res = await POST(makeReq({ phone: '+55 (11) 99122-6950', language: 'es' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when phone is taken by another user', async () => {
    const chain = makeChain();
    chain.upsert = jest.fn().mockResolvedValue({
      error: { message: 'whatsapp_channels_phone_unique constraint' },
    });
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-2' }, supabase: chain });
    const res = await POST(makeReq({ phone: '+5511999999999' }));
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/whatsapp/channel', () => {
  it('updates reminder channel settings', async () => {
    const res = await PATCH(makeReq({ reminders_enabled: false, is_default_reminder_channel: false }, 'PATCH'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.updated).toBe(true);
  });

  it('rejects empty channel settings update', async () => {
    const res = await PATCH(makeReq({}, 'PATCH'));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/whatsapp/channel', () => {
  it('deletes the channel', async () => {
    const res  = await DELETE(new NextRequest('http://localhost/api/whatsapp/channel', { method: 'DELETE' }));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.deleted).toBe(true);
  });
});

describe('POST /api/whatsapp/channel/verify', () => {
  const makeVerifyReq = (body: object) =>
    new NextRequest('http://localhost/api/whatsapp/channel/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('rejects non-6-digit code', async () => {
    const res = await VERIFY(makeVerifyReq({ code: '123' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no pending channel', async () => {
    const res = await VERIFY(makeVerifyReq({ code: '123456' }));
    expect(res.status).toBe(404);
  });

  it('rejects expired code', async () => {
    const expired = { id: 'ch-1', verification_code: '123456', code_expires_at: '2000-01-01T00:00:00Z', status: 'pending_verification' };
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1' }, supabase: makeChain(expired) });
    const res = await VERIFY(makeVerifyReq({ code: '123456' }));
    expect(res.status).toBe(410);
  });

  it('rejects wrong code', async () => {
    const channel = { id: 'ch-1', verification_code: '999999', code_expires_at: new Date(Date.now() + 60000).toISOString(), status: 'pending_verification' };
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1' }, supabase: makeChain(channel) });
    const res = await VERIFY(makeVerifyReq({ code: '123456' }));
    expect(res.status).toBe(400);
  });

  it('activates channel with correct code', async () => {
    const channel = { id: 'ch-1', verification_code: '123456', code_expires_at: new Date(Date.now() + 60000).toISOString(), status: 'pending_verification' };
    const chain   = makeChain(channel);
    chain.update  = jest.fn().mockReturnValue({ ...chain, eq: jest.fn().mockResolvedValue({ error: null }) });
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1' }, supabase: chain });
    const res  = await VERIFY(makeVerifyReq({ code: '123456' }));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.verified).toBe(true);
  });
});
