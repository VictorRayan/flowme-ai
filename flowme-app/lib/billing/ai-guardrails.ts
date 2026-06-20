import type { SupabaseClient } from '@supabase/supabase-js';

export type AiGuardWorkload = 'balys_text' | 'balys_tool' | 'connector_read' | 'web_grounded' | 'image_generation' | 'council' | 'meeting' | 'review' | 'briefing';

type GuardPolicy = {
  expensive: boolean;
  requestsPerMinute: number;
  dailyExpensiveLimit: number;
  concurrencyLimit: number;
  leaseSeconds: number;
};

export type AiGuardDecision = {
  allowed: boolean;
  reason?: 'rate' | 'daily' | 'concurrency';
  retryAfterSeconds?: number;
  leaseId: string | null;
};

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function guardPolicyForWorkload(workload: AiGuardWorkload): GuardPolicy {
  const expensiveDefaults: Partial<Record<AiGuardWorkload, number>> = {
    balys_tool: 100,
    connector_read: 100,
    web_grounded: 30,
    image_generation: 10,
    council: 10,
    meeting: 5,
    review: 6,
    briefing: 6,
  };
  const dailyDefault = expensiveDefaults[workload];
  return {
    expensive: dailyDefault !== undefined,
    requestsPerMinute: positiveEnv('BALYS_PRO_REQUESTS_PER_MINUTE', 30),
    dailyExpensiveLimit: positiveEnv(`BALYS_PRO_${workload.toUpperCase()}_DAILY_LIMIT`, dailyDefault || 1000),
    concurrencyLimit: positiveEnv('BALYS_PRO_EXPENSIVE_CONCURRENCY', 2),
    leaseSeconds: positiveEnv('BALYS_PRO_EXPENSIVE_LEASE_SECONDS', 900),
  };
}

export function resolveAiGuardWorkload(input: {
  action?: string | null;
  taskType?: string | null;
  toolDomain?: string | null;
  needsTools: boolean;
}): AiGuardWorkload {
  if (input.action === 'image') return 'image_generation';
  if (input.action === 'council' || input.taskType === 'council') return 'council';
  if (input.toolDomain === 'web') return 'web_grounded';
  if (['gmail', 'connectors'].includes(input.toolDomain || '') || ['gmail', 'drive', 'docs', 'sheets', 'slack'].includes(input.action || '')) return 'connector_read';
  return input.needsTools ? 'balys_tool' : 'balys_text';
}

export async function acquireAiUsageGuard(
  admin: SupabaseClient,
  userId: string,
  workload: AiGuardWorkload,
): Promise<AiGuardDecision> {
  const policy = guardPolicyForWorkload(workload);
  const { data, error } = await admin.rpc('acquire_ai_usage_guard', {
    p_user_id: userId,
    p_workload: workload,
    p_expensive: policy.expensive,
    p_requests_per_minute: policy.requestsPerMinute,
    p_daily_expensive_limit: policy.dailyExpensiveLimit,
    p_concurrency_limit: policy.concurrencyLimit,
    p_lease_seconds: policy.leaseSeconds,
  });
  if (error) throw new Error(error.message);
  const decision = data as { allowed?: boolean; reason?: AiGuardDecision['reason']; retry_after_seconds?: number; lease_id?: string | null } | null;
  return {
    allowed: decision?.allowed === true,
    ...(decision?.reason ? { reason: decision.reason } : {}),
    ...(decision?.retry_after_seconds ? { retryAfterSeconds: decision.retry_after_seconds } : {}),
    leaseId: decision?.lease_id || null,
  };
}

export async function releaseAiUsageGuard(admin: SupabaseClient, leaseId: string | null): Promise<void> {
  if (!leaseId) return;
  const { error } = await admin.rpc('release_ai_usage_guard', { p_lease_id: leaseId });
  if (error) throw new Error(error.message);
}

export async function cleanupAiGuardHistory(admin: SupabaseClient, now = new Date()): Promise<void> {
  const eventsBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const leasesBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [events, leases] = await Promise.all([
    admin.from('ai_guard_events').delete().lt('created_at', eventsBefore),
    admin.from('ai_guard_leases').delete().lt('expires_at', leasesBefore),
  ]);
  if (events.error) throw new Error(events.error.message);
  if (leases.error) throw new Error(leases.error.message);
}
