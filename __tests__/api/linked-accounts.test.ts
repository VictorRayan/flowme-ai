import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '@/app/api/linked-accounts/route';
import { DELETE } from '@/app/api/linked-accounts/[id]/route';

// Mock Auth
jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'mock-user-id' },
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: '1', name: 'Work' }], error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
    }
  })
}));

describe('/api/linked-accounts', () => {
  it('GET should return linked accounts', async () => {
    const req = new NextRequest('http://localhost/api/linked-accounts');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].name).toBe('Work');
  });

  it('POST should validate name length', async () => {
    const req = new NextRequest('http://localhost/api/linked-accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', type: 'work' })
    });
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE should execute soft delete', async () => {
    const req = new NextRequest('http://localhost/api/linked-accounts/1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) });
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});
