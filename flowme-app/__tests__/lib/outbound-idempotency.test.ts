import { runOutboundOnce } from '@/lib/ai/outbound-idempotency';
import { getSupabaseAdmin } from '@/lib/api/admin';

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn() }));

const context = { user: { id: 'user-a' }, requestId: 'request-a' } as any;

function adminWithClaim(claim: { status: string; receipt?: object }, markError: object | null = null) {
  const query: any = { eq: jest.fn().mockReturnThis() };
  query.update = jest.fn().mockReturnValue(query);
  query.then = (resolve: Function) => Promise.resolve({ error: markError }).then(resolve as any);
  const admin = {
    rpc: jest.fn().mockResolvedValue({ data: claim, error: null }),
    from: jest.fn().mockReturnValue(query),
  };
  (getSupabaseAdmin as jest.Mock).mockReturnValue(admin);
  return admin;
}

describe('outbound message idempotency', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends once and stores the provider receipt', async () => {
    const admin = adminWithClaim({ status: 'claimed' });
    const send = jest.fn().mockResolvedValue({ ts: '1.0' });
    const receipt = await runOutboundOnce(context, 'slack', { channel: 'C1', text: 'hello' }, send);
    expect(receipt).toEqual({ ts: '1.0' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith('claim_outbound_message', expect.objectContaining({ p_user_id: 'user-a', p_request_id: 'request-a', p_provider: 'slack' }));
    expect(admin.from).toHaveBeenCalledWith('outbound_message_events');
  });

  it('replays a completed receipt without posting again', async () => {
    adminWithClaim({ status: 'completed', receipt: { ts: '1.0' } });
    const send = jest.fn();
    expect(await runOutboundOnce(context, 'slack', { channel: 'C1', text: 'hello' }, send)).toEqual({ ts: '1.0' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not retry an uncertain or concurrent send', async () => {
    adminWithClaim({ status: 'in_progress' });
    const send = jest.fn();
    await expect(runOutboundOnce(context, 'gmail', { to: ['a@example.com'] }, send)).rejects.toThrow(/Check the destination/);
    expect(send).not.toHaveBeenCalled();
  });
});
