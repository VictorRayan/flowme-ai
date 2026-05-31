import { calculateCalendarReschedule, recordCalendarReschedule } from '@/lib/calendar/event-reschedule-history';

describe('calculateCalendarReschedule', () => {
  it('classifies a later move as postponed and preserves the total offset', () => {
    expect(calculateCalendarReschedule(
      '2026-05-30T14:00:00.000Z',
      '2026-05-30T16:00:00.000Z',
      '2026-05-30T17:00:00.000Z',
      '2026-05-30T15:30:00.000Z',
    )).toEqual({
      offset_minutes: 60,
      total_offset_minutes: 180,
      movement_type: 'postponed',
      minutes_before_previous_start: 30,
    });
  });

  it('classifies an earlier move as advanced', () => {
    expect(calculateCalendarReschedule(
      '2026-05-30T14:00:00.000Z',
      '2026-05-30T14:00:00.000Z',
      '2026-05-30T12:30:00.000Z',
      '2026-05-29T12:00:00.000Z',
    ).movement_type).toBe('advanced');
  });
});

describe('recordCalendarReschedule', () => {
  it('uses the immutable snapshot initial allocation', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { initial_start_at: '2026-05-30T14:00:00.000Z', initial_end_at: '2026-05-30T15:00:00.000Z' },
      error: null,
    });
    const snapshotSelect: any = { select: jest.fn(), eq: jest.fn(), maybeSingle };
    snapshotSelect.select.mockReturnValue(snapshotSelect);
    snapshotSelect.eq.mockReturnValue(snapshotSelect);
    const insert: any = { insert: jest.fn().mockResolvedValue({ error: null }) };
    const upsert: any = { upsert: jest.fn().mockResolvedValue({ error: null }) };
    const supabase = {
      from: jest.fn()
        .mockReturnValueOnce(snapshotSelect)
        .mockReturnValueOnce(insert)
        .mockReturnValueOnce(upsert),
    };

    await recordCalendarReschedule(supabase, {
      user_id: 'user-1',
      linked_account_id: 'account-1',
      provider_event_id: 'event-1',
      event_title: 'Deep work',
      previous_start_at: '2026-05-30T16:00:00.000Z',
      previous_end_at: '2026-05-30T17:00:00.000Z',
      new_start_at: '2026-05-30T17:00:00.000Z',
      new_end_at: '2026-05-30T18:00:00.000Z',
      changed_by: 'user_ui',
      changed_at: '2026-05-30T15:30:00.000Z',
    });

    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      initial_start_at: '2026-05-30T14:00:00.000Z',
      offset_minutes: 60,
      total_offset_minutes: 180,
      movement_type: 'postponed',
    }));
  });
});
