import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { createHighAiCostAlerts, reconcileBilling } from '@/lib/billing/reconciliation';
import { cleanupAiGuardHistory } from '@/lib/billing/ai-guardrails';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    const [reconciliation, aiCost] = await Promise.all([
      reconcileBilling(admin),
      createHighAiCostAlerts(admin),
      cleanupAiGuardHistory(admin),
    ]);
    return NextResponse.json({ ok: true, reconciliation, ai_cost: aiCost });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Billing reconciliation failed' }, { status: 500 });
  }
}
