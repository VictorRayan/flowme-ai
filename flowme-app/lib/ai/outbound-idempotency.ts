import { createHash, randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/api/admin';
import type { ToolContext } from './tools/Tool';

export async function runOutboundOnce<T extends object>(
  context: ToolContext,
  provider: 'slack' | 'gmail',
  payload: Record<string, unknown>,
  send: () => Promise<T>,
): Promise<T> {
  const admin = getSupabaseAdmin();
  const requestId = context.requestId || randomUUID();
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const { data: claim, error } = await admin.rpc('claim_outbound_message', {
    p_user_id: context.user.id,
    p_request_id: requestId,
    p_provider: provider,
    p_payload_hash: payloadHash,
  });
  if (error || !claim) throw new Error('Unable to claim outbound message');
  if (claim.status === 'completed') return claim.receipt as T;
  if (claim.status !== 'claimed') throw new Error('Message delivery may already be in progress. Check the destination before retrying.');

  const receipt = await send();
  const { error: markError } = await admin.from('outbound_message_events')
    .update({ completed_at: new Date().toISOString(), receipt })
    .eq('user_id', context.user.id)
    .eq('request_id', requestId)
    .eq('provider', provider)
    .eq('payload_hash', payloadHash);
  if (markError) throw new Error('Message was sent, but its receipt could not be saved. Check the destination before retrying.');
  return receipt;
}
