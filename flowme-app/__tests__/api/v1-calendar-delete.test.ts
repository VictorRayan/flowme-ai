import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/v1/calendar/delete/route';
import { deleteCalendarEvent } from '@/lib/google/google-calendar';

const mockIsFeatureAllowed = jest.fn();

jest.mock('@/lib/billing/entitlements', () => ({
  getUserEntitlements: jest.fn().mockResolvedValue({ features: { calendar: true } }),
  isFeatureAllowed: (...args: unknown[]) => mockIsFeatureAllowed(...args),
}));

jest.mock('@/lib/google/google-calendar', () => ({
  deleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
}));

function makeChain() {
  let currentTable = '';
  const rows: Record<string, unknown[]> = {
    linked_accounts: [{ id: 'account-1', is_active: true, is_deleted: false }],
    goal_calendar_events: [{
      id: 'link-1',
      provider_event_id: 'event-1',
      linked_account_id: 'account-1',
      action_plan_id: 'plan-1',
      goal_id: 'goal-weekly',
      title: 'Prospectar clientes',
      scheduled_date: '2026-05-25',
      start_at: '2026-05-25T09:00:00.000Z',
      end_at: '2026-05-25T09:30:00.000Z',
      duration_minutes: 30,
      status: 'deleted',
    }],
  };
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: rows[currentTable] || [], error: null }).then(resolve as any, reject as any);
    },
  };
  chain.from = jest.fn((table: string) => {
    currentTable = table;
    return chain;
  });
  const methods = ['select', 'eq', 'update'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn(() => Promise.resolve({
    data: (rows[currentTable] || [])[0] || null,
    error: null,
  }));
  return chain;
}

jest.mock('@/lib/api/api-key-auth', () => ({
  requireApiKeyAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ userId: 'user-1', supabase: makeChain() })
  ),
}));

describe('DELETE /api/v1/calendar/delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFeatureAllowed.mockReturnValue(true);
  });

  it('returns FEATURE_LOCKED for API keys owned by Free users', async () => {
    mockIsFeatureAllowed.mockReturnValue(false);
    const res = await DELETE(new NextRequest('http://localhost/api/v1/calendar/delete', {
      method: 'DELETE',
      body: JSON.stringify({ event_id: 'event-1', linked_account_id: 'account-1' }),
    }));
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body.error.code).toBe('FEATURE_LOCKED');
  });

  it('marks goal calendar events deleted when deleting through the external API', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/v1/calendar/delete', {
      method: 'DELETE',
      body: JSON.stringify({
        event_id: 'event-1',
        linked_account_id: 'account-1',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(deleteCalendarEvent).toHaveBeenCalledWith('account-1', 'event-1');
    expect(body.goal_event_impact.needs_replan).toBe(true);
    expect(body.goal_event_impact.deleted_events[0].title).toBe('Prospectar clientes');
  });
});
