import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { claimBillingNotifications, deliverBillingNotification } from '@/lib/billing/notifications';

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const admin = getSupabaseAdmin();
    const notifications = await claimBillingNotifications(admin, 20);
    const results = [];
    for (const notification of notifications) {
      try {
        const result = await deliverBillingNotification(admin, notification);
        results.push({ id: notification.id, status: result.status });
      } catch (error) {
        await admin.from('billing_notifications').update({
          status: notification.attempts >= 4 ? 'failed' : 'pending',
          attempts: notification.attempts + 1,
          processing_started_at: null,
          next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          last_error: error instanceof Error ? error.message : 'Notification delivery failed',
          updated_at: new Date().toISOString(),
        }).eq('id', notification.id).eq('status', 'pending');
        results.push({ id: notification.id, status: 'error' });
      }
    }
    return NextResponse.json({ ok: true, claimed: notifications.length, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Billing notification delivery failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
