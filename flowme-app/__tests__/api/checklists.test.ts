import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/checklists/route';
import { PATCH, DELETE } from '@/app/api/checklists/[id]/route';
import { PATCH as PATCH_ITEM } from '@/app/api/checklists/[id]/items/[itemId]/route';

const listRows = [{ id: 'list-1', name: 'Compra de mercado', status: 'active', created_at: '2026-06-27T00:00:00.000Z' }];
const itemRows = [{ id: 'item-1', checklist_id: 'list-1', title: 'Arroz', checked: false, sort_order: 0 }];

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

function makeChain(listData: any[] = [], singleData: any = null) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  for (const method of ['select', 'eq', 'order', 'limit', 'in']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.delete = mockDelete.mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() => Promise.resolve({
    user: { id: 'user-1' },
    supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  })),
}));

describe('checklists API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'checklists') return makeChain(listRows, listRows[0]);
      if (table === 'checklist_items') return makeChain(itemRows, itemRows[0]);
      return makeChain();
    });
  });

  it('lists checklists with ordered items', async () => {
    const response = await GET(new NextRequest('http://localhost/api/checklists?status=active'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checklists).toEqual([
      expect.objectContaining({
        id: 'list-1',
        items: [expect.objectContaining({ id: 'item-1', title: 'Arroz' })],
      }),
    ]);
  });

  it('creates a checklist with items', async () => {
    const response = await POST(new NextRequest('http://localhost/api/checklists', {
      method: 'POST',
      body: JSON.stringify({ name: 'Compra de mercado', items: ['Arroz', 'Leite'], created_by: 'voice' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checklist).toEqual(expect.objectContaining({ id: 'list-1', items: itemRows }));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', name: 'Compra de mercado', created_by: 'voice' }));
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Arroz', sort_order: 0 }),
      expect.objectContaining({ title: 'Leite', sort_order: 1 }),
    ]);
  });

  it('rejects checklist creation without items', async () => {
    const response = await POST(new NextRequest('http://localhost/api/checklists', {
      method: 'POST',
      body: JSON.stringify({ name: 'Vazia', items: [] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates checklist status', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/checklists/list-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }), { params: Promise.resolve({ id: 'list-1' }) });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('updates item checked state', async () => {
    const response = await PATCH_ITEM(new NextRequest('http://localhost/api/checklists/list-1/items/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ checked: true }),
    }), { params: Promise.resolve({ id: 'list-1', itemId: 'item-1' }) });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ checked: true }));
  });

  it('deletes a checklist', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/checklists/list-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'list-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});
