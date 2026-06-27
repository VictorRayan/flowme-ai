import { checklistsCompleteTool, checklistsCreateTool, checklistsSetItemTool } from '@/lib/ai/tools/checklists-tools';

const listRow = { id: 'list-1', name: 'Compra de mercado', status: 'active', created_at: '2026-06-27T00:00:00.000Z' };
const itemRow = { id: 'item-1', checklist_id: 'list-1', title: 'Arroz', checked: false, sort_order: 0 };
const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

function chain(listData: any[] = [], singleData: any = null) {
  const query: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'eq', 'order', 'limit']) query[method] = jest.fn().mockReturnValue(query);
  query.insert = mockInsert.mockReturnValue(query);
  query.update = mockUpdate.mockReturnValue(query);
  query.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return query;
}

const context: any = {
  user: { id: 'user-1' },
  timezone: 'America/Sao_Paulo',
  nowIso: '2026-06-27T12:00:00.000Z',
  supabase: { from: mockFrom },
};

describe('checklists tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'checklists') return chain([listRow], listRow);
      if (table === 'checklist_items') return chain([itemRow], itemRow);
      return chain();
    });
  });

  it('creates a checklist from Balys', async () => {
    const result = await checklistsCreateTool.call({ name: 'Compra de mercado', items: ['Arroz'] }, context);

    expect(result.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'balys' }));
    expect(result.receipt).toEqual(expect.objectContaining({ name: 'Compra de mercado' }));
  });

  it('marks an item using natural names', async () => {
    const result = await checklistsSetItemTool.call({ list_name: 'mercado', item_name: 'arroz', checked: true }, context);

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ checked: true }));
  });

  it('completes a checklist using a natural list name', async () => {
    const result = await checklistsCompleteTool.call({ list_name: 'mercado' }, context);

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });
});
