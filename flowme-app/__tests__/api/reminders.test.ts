import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/reminders/route';
import { DELETE, PATCH } from '@/app/api/reminders/[id]/route';
import { createReminder, listReminders, updateReminder, cancelReminder } from '@/lib/reminders/reminders';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }),
}));

jest.mock('@/lib/reminders/reminders', () => ({
  createReminder: jest.fn().mockResolvedValue({ id: 'rem-1', message: 'Oi', scheduled_for: '2026-05-20T10:00:00Z', status: 'scheduled', channel_preference: 'whatsapp' }),
  listReminders: jest.fn().mockResolvedValue([{ id: 'rem-1', message: 'Oi' }]),
  updateReminder: jest.fn().mockResolvedValue({ id: 'rem-1', message: 'Novo' }),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
}));

const makeReq = (url: string, body?: object, method = 'POST') =>
  new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('GET /api/reminders', () => {
  it('lists scheduled reminders by default', async () => {
    const res = await GET(new NextRequest('http://localhost/api/reminders'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(listReminders).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ status: 'scheduled' }));
  });

  it('rejects invalid status', async () => {
    const res = await GET(new NextRequest('http://localhost/api/reminders?status=weird'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/reminders', () => {
  it('creates a reminder', async () => {
    const res = await POST(makeReq('http://localhost/api/reminders', {
      message: 'Me lembre',
      scheduled_for: '2026-05-20T10:00:00Z',
      channel_preference: 'whatsapp',
    }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(createReminder).toHaveBeenCalled();
  });

  it('rejects missing message', async () => {
    const res = await POST(makeReq('http://localhost/api/reminders', { scheduled_for: '2026-05-20T10:00:00Z' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid channel preference', async () => {
    const res = await POST(makeReq('http://localhost/api/reminders', {
      message: 'Me lembre',
      scheduled_for: '2026-05-20T10:00:00Z',
      channel_preference: 'sms',
    }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/reminders/[id]', () => {
  it('updates a reminder', async () => {
    const res = await PATCH(makeReq('http://localhost/api/reminders/rem-1', { message: 'Novo' }, 'PATCH'), {
      params: Promise.resolve({ id: 'rem-1' }),
    });
    expect(res.status).toBe(200);
    expect(updateReminder).toHaveBeenCalledWith({}, 'user-1', 'rem-1', expect.objectContaining({ message: 'Novo' }));
  });

  it('rejects empty body', async () => {
    const res = await PATCH(makeReq('http://localhost/api/reminders/rem-1', {}, 'PATCH'), {
      params: Promise.resolve({ id: 'rem-1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/reminders/[id]', () => {
  it('cancels the reminder', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/reminders/rem-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'rem-1' }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
    expect(cancelReminder).toHaveBeenCalledWith({}, 'user-1', 'rem-1');
  });
});

