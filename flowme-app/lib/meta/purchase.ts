import { sendMetaEvent } from './conversions-api';

interface AdminLike {
  from: (table: string) => any;
}

/**
 * Fires a server-side Purchase to the Meta Conversions API for a confirmed
 * public checkout. Uses a deterministic event_id (`purchase_<sessionId>`) so it
 * deduplicates against the browser Purchase from the checkout page and against
 * repeated webhook deliveries. This is the reliable Purchase signal for Pix,
 * where the buyer usually pays in their bank app and never returns to the tab.
 */
export async function sendPublicCheckoutPurchase(admin: AdminLike, sessionId: string): Promise<void> {
  const { data: session } = await admin.from('public_checkout_sessions')
    .select('id,email,phone,phone_e164,amount_cents,currency,meta_external_id,metadata')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return;

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  await sendMetaEvent({
    event_name: 'Purchase',
    event_id: `purchase_${session.id}`,
    event_source_url: 'https://app.flow-me.online/checkout',
    external_id: session.meta_external_id || undefined,
    email: session.email || undefined,
    phone: session.phone_e164 || session.phone || undefined,
    fbp: typeof metadata.meta_fbp === 'string' ? metadata.meta_fbp : undefined,
    fbc: typeof metadata.meta_fbc === 'string' ? metadata.meta_fbc : undefined,
    value: Number(session.amount_cents || 0) / 100,
    currency: String(session.currency || 'BRL'),
  });
}
