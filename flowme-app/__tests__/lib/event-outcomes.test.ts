import { upsertEventOutcome } from '@/lib/today/event-outcomes';

function makeUpsertChain(data: unknown) {
  const chain: any = {};
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data, error: null });
  return chain;
}

describe('upsertEventOutcome', () => {
  it('requires a reason when an event is explicitly not done', async () => {
    await expect(upsertEventOutcome({ from: jest.fn() }, 'user-1', {
      event_id: 'calendar_event:event-1',
      outcome: 'not_done',
    })).rejects.toThrow('reason is required for not_done');
  });

  it('stores reason metadata for not-done answers', async () => {
    const chain = makeUpsertChain({
      event_id: 'calendar_event:event-1',
      outcome: 'not_done',
      outcome_reason: 'Urgent meeting',
      reason_code: 'unexpected',
      answered_at: '2026-05-31T10:00:00.000Z',
      answer_source: 'today_ui',
    });

    await upsertEventOutcome({ from: jest.fn().mockReturnValue(chain) }, 'user-1', {
      event_id: 'calendar_event:event-1',
      outcome: 'not_done',
      outcome_reason: 'Urgent meeting',
      reason_code: 'unexpected',
      answer_source: 'today_ui',
    });

    expect(chain.upsert).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'not_done',
      outcome_reason: 'Urgent meeting',
      reason_code: 'unexpected',
      answer_source: 'today_ui',
    }), { onConflict: 'user_id,event_id' });
  });
});
