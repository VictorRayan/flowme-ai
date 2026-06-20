import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { applyAppleNotificationState, syncVerifiedMobileSubscription, verifyAndDecodeAppleJws, verifyAppleSubscription } from '@/lib/billing/mobile-subscriptions';
import { recordBillingAdminAlert } from '@/lib/billing/admin-alerts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.signedPayload !== 'string') return NextResponse.json({ ok: false, error: 'signedPayload required' }, { status: 400 });
    const notification = verifyAndDecodeAppleJws(body.signedPayload);
    const eventId = String(notification.notificationUUID || '');
    const data = notification.data as Record<string, unknown> | undefined;
    const signedTransaction = typeof data?.signedTransactionInfo === 'string' ? data.signedTransactionInfo : '';
    if (!eventId || !signedTransaction) return NextResponse.json({ ok: true, ignored: true });
    const transactionPayload = verifyAndDecodeAppleJws(signedTransaction);
    const userId = typeof transactionPayload.appAccountToken === 'string' ? transactionPayload.appAccountToken : '';
    if (!userId) return NextResponse.json({ ok: true, ignored: true });
    const admin = getSupabaseAdmin();
    const { error: eventError } = await admin.from('billing_events').insert({
      provider: 'apple', event_id: eventId, event_type: String(notification.notificationType || 'UNKNOWN'),
      user_id: userId, provider_subscription_id: transactionPayload.transactionId || null, payload: notification,
    });
    if (eventError?.code === '23505') {
      const { data: existing } = await admin.from('billing_events').select('processed_at')
        .eq('provider', 'apple').eq('event_id', eventId).maybeSingle();
      if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    }
    if (eventError && eventError.code !== '23505') throw new Error(eventError.message);
    const verified = applyAppleNotificationState(
      verifyAppleSubscription(signedTransaction, userId),
      String(notification.notificationType || ''),
      typeof notification.subtype === 'string' ? notification.subtype : undefined,
    );
    await syncVerifiedMobileSubscription(admin, userId, verified);
    await admin.from('billing_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'apple').eq('event_id', eventId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[apple-webhook] failed:', error);
    await recordBillingAdminAlert(getSupabaseAdmin(), {
      kind: 'webhook_failure', severity: 'critical', provider: 'apple',
      dedupeKey: `apple-webhook:${new Date().toISOString().slice(0, 13)}`,
      metadata: { error: error instanceof Error ? error.message : 'unknown' },
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Apple webhook failed' }, { status: 400 });
  }
}
