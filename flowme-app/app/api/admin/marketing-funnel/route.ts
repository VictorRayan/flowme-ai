import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';

type Locale = 'pt-BR' | 'en-US';
type FunnelBucket = {
  landing_visits: number;
  mql: number;
  mql_monthly: number;
  mql_annual: number;
  mql_unknown_interval: number;
  checkout_visits: number;
  sales: number;
  pix_issued: number;
  pix_paid: number;
  card_attempts: number;
  card_paid: number;
  revenue_cents: number;
};
type CheckoutAttemptRow = {
  id: string;
  user_id?: string | null;
  email?: string | null;
  locale: string;
  payment_method: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  paid_at?: string | null;
  updated_at?: string | null;
};
type CheckoutRowWithKind = CheckoutAttemptRow & { __kind: 'authenticated' | 'public' };

const LOCALES: Locale[] = ['pt-BR', 'en-US'];

function emptyBucket(): FunnelBucket {
  return {
    landing_visits: 0,
    mql: 0,
    mql_monthly: 0,
    mql_annual: 0,
    mql_unknown_interval: 0,
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

function billingIntervalOf(metadata: unknown): 'monthly' | 'annual' | 'unknown' {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'unknown';
  const value = (metadata as Record<string, unknown>).billing_interval;
  if (value === 'monthly' || value === 'annual') return value;
  return 'unknown';
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

function dateOnly(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function rangeFromRequest(req: NextRequest) {
  const startParam = dateOnly(req.nextUrl.searchParams.get('start_date'));
  const endParam = dateOnly(req.nextUrl.searchParams.get('end_date'));
  const end = endParam ? new Date(`${endParam}T00:00:00.000Z`) : new Date();
  if (endParam) end.setUTCDate(end.getUTCDate() + 1);
  const start = startParam ? new Date(`${startParam}T00:00:00.000Z`) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { since: start.toISOString(), until: end.toISOString(), start_date: start.toISOString().slice(0, 10), end_date: new Date(end.getTime() - 1).toISOString().slice(0, 10) };
}

function applyRange(query: any, column: string, since: string, until: string) {
  return query.gte(column, since).lt(column, until);
}

export async function GET(req: NextRequest) {
  try {
    await requireManagementRole(req, ['billing_manager', 'admin']);
    const admin = getSupabaseAdmin();
    const range = rangeFromRequest(req);
    const [visits, leads, attempts, publicSessions, revenue, entitlements, aiUsage, messages, notes, onboardingEvents] = await Promise.all([
      applyRange(admin.from('marketing_page_visits').select('id,locale,surface,occurred_at'), 'occurred_at', range.since, range.until).limit(5000),
      applyRange(admin.from('marketing_leads').select('id,locale,metadata,created_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('billing_checkout_attempts').select('id,user_id,locale,payment_method,status,amount_cents,currency,provider,provider_payment_id,metadata,created_at,paid_at,updated_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('public_checkout_sessions').select('id,email,locale,payment_method,status,amount_cents,currency,provider,provider_payment_id,metadata,created_at,paid_at,updated_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('billing_revenue_events').select('id,user_id,kind,currency,amount_cents,occurred_at'), 'occurred_at', range.since, range.until).limit(5000),
      admin.from('user_entitlements').select('user_id,has_pro,billing_state,updated_at').limit(10000),
      applyRange(admin.from('ai_usage_logs').select('user_id,created_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('thread_messages').select('user_id,created_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('notes').select('user_id,created_at'), 'created_at', range.since, range.until).limit(5000),
      applyRange(admin.from('onboarding_events').select('user_id,email,session_id,event_type,step_key,step_index,occurred_at'), 'occurred_at', range.since, range.until).limit(10000),
    ]);

    const funnel = bucketMap();
    for (const visit of visits.data || []) {
      const bucket = funnel[localeOf(visit.locale)];
      if (visit.surface === 'checkout') bucket.checkout_visits += 1;
      else bucket.landing_visits += 1;
    }
    for (const lead of leads.data || []) {
      const bucket = funnel[localeOf(lead.locale)];
      const interval = billingIntervalOf(lead.metadata);
      bucket.mql += 1;
      if (interval === 'monthly') bucket.mql_monthly += 1;
      else if (interval === 'annual') bucket.mql_annual += 1;
      else bucket.mql_unknown_interval += 1;
    }

    const paymentAttempts: Array<{
      id: string;
      kind: 'authenticated' | 'public';
      user_id: string | null;
      email: string | null;
      locale: Locale;
      payment_method: string;
      status: string;
      provider: string;
      amount_cents: number;
      currency: string;
      error_message: string | null;
      created_at: string;
      paid_at: string | null;
    }> = [];

    const checkoutRows: CheckoutRowWithKind[] = [
      ...((attempts.data || []) as CheckoutAttemptRow[]).map(row => ({ ...row, __kind: 'authenticated' as const })),
      ...((publicSessions.data || []) as CheckoutAttemptRow[]).map(row => ({ ...row, __kind: 'public' as const })),
    ];
    for (const attempt of checkoutRows) {
      const locale = localeOf(attempt.locale);
      const bucket = funnel[locale];
      const method = attempt.payment_method;
      const status = attempt.status;
      const paidStatus = status === 'paid' || status === 'claimed';
      if (paidStatus) {
        bucket.sales += 1;
        bucket.revenue_cents += Number(attempt.amount_cents || 0);
      }
      if (method === 'pix') {
        if (attempt.provider_payment_id || ['awaiting_payment', 'paid', 'claimed', 'past_due', 'expired'].includes(status)) bucket.pix_issued += 1;
        if (paidStatus) bucket.pix_paid += 1;
      }
      if (method === 'card') {
        bucket.card_attempts += 1;
        if (paidStatus) bucket.card_paid += 1;
      }
      const metadata = (attempt.metadata || {}) as Record<string, unknown>;
      paymentAttempts.push({
        id: attempt.id,
        kind: attempt.__kind,
        user_id: attempt.user_id || null,
        email: attempt.email || null,
        locale,
        payment_method: method,
        status,
        provider: attempt.provider,
        amount_cents: Number(attempt.amount_cents || 0),
        currency: attempt.currency,
        error_message: typeof metadata.provider_error_message === 'string' ? metadata.provider_error_message : null,
        created_at: attempt.created_at,
        paid_at: attempt.paid_at || null,
      });
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

    const onboardingByKey = new Map<string, {
      user_id: string | null;
      email: string | null;
      session_id: string | null;
      started_at: string | null;
      completed_at: string | null;
      last_event_at: string;
      last_step_key: string;
      last_step_index: number;
    }>();
    for (const event of onboardingEvents.data || []) {
      const key = event.user_id || event.session_id || event.email || `event:${event.occurred_at}`;
      const current = onboardingByKey.get(key);
      const next = current || {
        user_id: event.user_id || null,
        email: event.email || null,
        session_id: event.session_id || null,
        started_at: null,
        completed_at: null,
        last_event_at: event.occurred_at,
        last_step_key: event.step_key,
        last_step_index: Number(event.step_index || 0),
      };
      if (event.event_type === 'started' && (!next.started_at || event.occurred_at < next.started_at)) next.started_at = event.occurred_at;
      if (event.event_type === 'completed' && (!next.completed_at || event.occurred_at > next.completed_at)) next.completed_at = event.occurred_at;
      if (event.occurred_at >= next.last_event_at) {
        next.last_event_at = event.occurred_at;
        next.last_step_key = event.step_key;
        next.last_step_index = Number(event.step_index || 0);
      }
      onboardingByKey.set(key, next);
    }
    const onboardingLogs = Array.from(onboardingByKey.values())
      .sort((a, b) => b.last_event_at.localeCompare(a.last_event_at))
      .slice(0, 200)
      .map(item => ({ ...item, status: item.completed_at ? 'completed' : 'started' }));

    return apiSuccess({
      since: range.since,
      until: range.until,
      start_date: range.start_date,
      end_date: range.end_date,
      funnel,
      card_attempts: paymentAttempts.filter(item => item.payment_method === 'card').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100),
      payment_attempts: paymentAttempts.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150),
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
      onboarding: {
        started: onboardingLogs.filter(item => item.started_at).length,
        completed: onboardingLogs.filter(item => item.completed_at).length,
        logs: onboardingLogs,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load marketing funnel', 500);
  }
}
