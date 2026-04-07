import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/microactivities/route';

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'mock-user-id' },
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: '1', title: 'Test Activity' }], error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'new-id', title: 'New Activity' }, error: null }),
    }
  })
}));

describe('/api/microactivities', () => {
  it('GET should require start and end dates', async () => {
    const req = new NextRequest('http://localhost/api/microactivities');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST should create microactivity successfully', async () => {
    const req = new NextRequest('http://localhost/api/microactivities', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Activity', start_at: '2025-01-01T10:00:00Z' })
    });
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.microactivity.title).toBe('New Activity');
  });
});
