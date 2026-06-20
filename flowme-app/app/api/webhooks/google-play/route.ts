import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { fetchGoogleSubscription, syncVerifiedMobileSubscription } from '@/lib/billing/mobile-subscriptions';
import { recordBillingAdminAlert } from '@/lib/billing/admin-alerts';

export async function POST(req: NextRequest) {
  const expectedToken = process.env.GOOGLE_PLAY_WEBHOOK_TOKEN;
  if (!expectedToken || req.headers.get('authorization') !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const eventId = String(body.message?.messageId || '');
    const encoded = body.message?.data;
    if (!eventId || typeof encoded !== 'string') return NextResponse.json({ ok: false, error: 'invalid Pub/Sub message' }, { status: 400 });
    const notification = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    const purchaseToken = notification.subscriptionNotification?.purchaseToken;
    if (typeof purchaseToken !== 'string') return NextResponse.json({ ok: true, ignored: true });
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from('user_subscriptions').select('user_id')
      .eq('billing_provider', 'google').eq('provider_purchase_token', purchaseToken).maybeSingle();
    const { error: eventError } = await admin.from('billing_events').insert({
      provider: 'google', event_id: eventId,
      event_type: `RTDN_${notification.subscriptionNotification?.notificationType || 'UNKNOWN'}`,
      user_id: existing?.user_id || null, provider_subscription_id: purchaseToken, payload: notification,
    });
    if (eventError?.code === '23505') {
      const { data: priorEvent } = await admin.from('billing_events').select('processed_at')
        .eq('provider', 'google').eq('event_id', eventId).maybeSingle();
      if (priorEvent?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    }
    if (eventError && eventError.code !== '23505') throw new Error(eventError.message);
    if (!existing?.user_id) return NextResponse.json({ ok: true, ignored: true });
    const verified = await fetchGoogleSubscription(purchaseToken, existing.user_id);
    await syncVerifiedMobileSubscription(admin, existing.user_id, verified);
    await admin.from('billing_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'google').eq('event_id', eventId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[google-play-webhook] failed:', error);
    await recordBillingAdminAlert(getSupabaseAdmin(), {
      kind: 'webhook_failure', severity: 'critical', provider: 'google',
      dedupeKey: `google-webhook:${new Date().toISOString().slice(0, 13)}`,
      metadata: { error: error instanceof Error ? error.message : 'unknown' },
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Google Play webhook failed' }, { status: 500 });
  }
}
