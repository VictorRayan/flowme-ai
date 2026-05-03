import { eventsCreateTool, eventsDeleteTool, eventsListTool } from '@/lib/ai/tools/events-tools';

function makeContext() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const supabase = {
    calls,
    from(table: string) {
      let operation = '';
      const builder: any = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder; },
        insert(...args: unknown[]) { operation = 'insert'; calls.push({ table, method: 'insert', args }); return builder; },
        delete(...args: unknown[]) { operation = 'delete'; calls.push({ table, method: 'delete', args }); return builder; },
        eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return builder; },
        gte(...args: unknown[]) { calls.push({ table, method: 'gte', args }); return builder; },
        lt(...args: unknown[]) { calls.push({ table, method: 'lt', args }); return builder; },
        in(...args: unknown[]) { calls.push({ table, method: 'in', args }); return builder; },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder; },
        single() {
          return Promise.resolve({ data: { id: 'event-1', title: 'Stretch' }, error: null });
        },
        then(resolve: Function, reject: Function) {
          if (operation === 'delete') return Promise.resolve({ data: [{ id: 'event-1' }], error: null }).then(resolve as any, reject as any);
          return Promise.resolve({ data: [{ id: 'event-1', title: 'Stretch' }], error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };

  return {
    supabase,
    user: { id: 'user-1' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-02T12:00:00.000Z',
  } as any;
}

describe('events tools', () => {
  it('lists Flowme events', async () => {
    const context = makeContext();
    const result = await eventsListTool.call({
      start_iso: '2026-05-02T00:00:00Z',
      end_iso: '2026-05-03T00:00:00Z',
    }, context);

    expect(result.ok).toBe(true);
    expect((result.receipt as any).count).toBe(1);
  });

  it('creates a flexible Flowme event', async () => {
    const context = makeContext();
    const result = await eventsCreateTool.call({
      title: 'Stretch',
      scheduled_date: '2026-05-02',
      duration_minutes: 5,
    }, context);

    expect(result.ok).toBe(true);
    expect(context.supabase.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'microactivities', method: 'insert' }),
    ]));
  });

  it('deletes one or more Flowme events', async () => {
    const result = await eventsDeleteTool.call({ ids: ['event-1'] }, makeContext());

    expect(result.ok).toBe(true);
    expect((result.receipt as any).deleted_count).toBe(1);
  });
});
