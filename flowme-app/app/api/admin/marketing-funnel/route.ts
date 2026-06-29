import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';

type Locale = 'pt-BR' | 'en-US';
type FunnelBucket = {
  landing_visits: number;
  mql: number;
  checkout_visits: number;
  sales: number;
  pix_issued: number;
  pix_paid: number;
  card_attempts: number;
  card_paid: number;
  revenue_cents: number;
};

const LOCALES: Locale[] = ['pt-BR', 'en-US'];

function emptyBucket(): FunnelBucket {
  return {
    landing_visits: 0,
    mql: 0,
    checkout_visits: 0,
    sales: 0,
    pix_issued: 0,
    pix_paid: 0,
    card_attempts: 0,
    card_paid: 0,
    revenue_cents: 0,
  };
}

function bucketMap() {
  return {
    'pt-BR': emptyBucket(),
    'en-US': emptyBucket(),
  } satisfies Record<Locale, FunnelBucket>;
}

function localeOf(value: unknown): Locale {
  return value === 'en-US' ? 'en-US' : 'pt-BR';
}

function hourKey(value: string) {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function incrementUnique(map: Map<string, Set<string>>, key: string, userId: string | null | undefined) {
  if (!userId) return;
  const set = map.get(key) || new Set<string>();
  set.add(userId);
  map.set(key, set);
}

export async function GET(req: NextRequest) {
  try {
    await requireManagementRole(req, ['billing_manager', 'admin']);
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [visits, leads, attempts, revenue, entitlements, aiUsage, messages, notes] = await Promise.all([
      admin.from('marketing_page_visits').select('id,locale,surface,occurred_at').gte('occurred_at', since).limit(5000),
      admin.from('marketing_leads').select('id,locale,created_at').gte('created_at', since).limit(5000),
      admin.from('billing_checkout_attempts').select('id,user_id,locale,payment_method,status,amount_cents,currency,provider,provider_payment_id,metadata,created_at,paid_at,updated_at').gte('created_at', since).limit(5000),
      admin.from('billing_revenue_events').select('id,user_id,kind,currency,amount_cents,occurred_at').gte('occurred_at', since).limit(5000),
      admin.from('user_entitlements').select('user_id,has_pro,billing_state,updated_at').limit(10000),
      admin.from('ai_usage_logs').select('user_id,created_at').gte('created_at', since).limit(5000),
      admin.from('thread_messages').select('user_id,created_at').gte('created_at', since).limit(5000),
      admin.from('notes').select('user_id,created_at').gte('created_at', since).limit(5000),
    ]);

    const funnel = bucketMap();
    for (const visit of visits.data || []) {
      const bucket = funnel[localeOf(visit.locale)];
      if (visit.surface === 'checkout') bucket.checkout_visits += 1;
      else bucket.landing_visits += 1;
    }
    for (const lead of leads.data || []) {
      funnel[localeOf(lead.locale)].mql += 1;
    }

    const cardAttempts: Array<{
      id: string;
      locale: Locale;
      status: string;
      provider: string;
      amount_cents: number;
      error_message: string | null;
      created_at: string;
    }> = [];

    for (const attempt of attempts.data || []) {
      const locale = localeOf(attempt.locale);
      const bucket = funnel[locale];
      const method = attempt.payment_method;
      const status = attempt.status;
      if (status === 'paid') {
        bucket.sales += 1;
        bucket.revenue_cents += Number(attempt.amount_cents || 0);
      }
      if (method === 'pix') {
        if (attempt.provider_payment_id || ['awaiting_payment', 'paid', 'past_due', 'expired'].includes(status)) bucket.pix_issued += 1;
        if (status === 'paid') bucket.pix_paid += 1;
      }
      if (method === 'card') {
        bucket.card_attempts += 1;
        if (status === 'paid') bucket.card_paid += 1;
        const metadata = (attempt.metadata || {}) as Record<string, unknown>;
        cardAttempts.push({
          id: attempt.id,
          locale,
          status,
          provider: attempt.provider,
          amount_cents: Number(attempt.amount_cents || 0),
          error_message: typeof metadata.provider_error_message === 'string' ? metadata.provider_error_message : null,
          created_at: attempt.created_at,
        });
      }
    }

    const revenueByKind = { payment_received: 0, refund: 0, chargeback: 0 };
    for (const event of revenue.data || []) {
      if (event.kind === 'payment_received') revenueByKind.payment_received += Number(event.amount_cents || 0);
      if (event.kind === 'refund') revenueByKind.refund += Number(event.amount_cents || 0);
      if (event.kind === 'chargeback') revenueByKind.chargeback += Number(event.amount_cents || 0);
    }

    const entitlementRows = entitlements.data || [];
    const registeredUsers = {
      total: entitlementRows.length,
      free: entitlementRows.filter(row => !row.has_pro).length,
      paid: entitlementRows.filter(row => row.has_pro).length,
    };

    const activeByHour = new Map<string, Set<string>>();
    const activeByDay = new Map<string, Set<string>>();
    for (const row of [...(aiUsage.data || []), ...(messages.data || []), ...(notes.data || [])]) {
      incrementUnique(activeByHour, hourKey(row.created_at), row.user_id);
      incrementUnique(activeByDay, dayKey(row.created_at), row.user_id);
    }

    return apiSuccess({
      since,
      funnel,
      card_attempts: cardAttempts.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100),
      revenue: {
        gross_cents: revenueByKind.payment_received,
        refunds_cents: revenueByKind.refund,
        chargebacks_cents: revenueByKind.chargeback,
        net_cents: revenueByKind.payment_received - revenueByKind.refund - revenueByKind.chargeback,
      },
      registered_users: registeredUsers,
      active_users: {
        by_hour: Array.from(activeByHour, ([period, users]) => ({ period, users: users.size })).sort((a, b) => a.period.localeCompare(b.period)),
        by_day: Array.from(activeByDay, ([period, users]) => ({ period, users: users.size })).sort((a, b) => a.period.localeCompare(b.period)),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load marketing funnel', 500);
  }
}
