import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';

export type ManagementRole = 'support_manager' | 'billing_manager' | 'admin';

export async function requireBillingAdmin(req: NextRequest) {
  const auth = await requireAuth(req);
  const allowed = new Set((process.env.BILLING_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
  if (!allowed.has(auth.user.id)) throw new Error('FORBIDDEN');
  return auth;
}

export async function requireManagementRole(req: NextRequest, roles: ManagementRole[]) {
  const auth = await requireAuth(req);
  const legacyAllowed = new Set((process.env.BILLING_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
  if (legacyAllowed.has(auth.user.id)) return { ...auth, role: 'admin' as const };
  const { data } = await getSupabaseAdmin().from('app_user_roles')
    .select('role')
    .eq('user_id', auth.user.id)
    .in('role', roles)
    .limit(1)
    .maybeSingle();
  if (!data?.role) throw new Error('FORBIDDEN');
  return { ...auth, role: data.role as ManagementRole };
}
