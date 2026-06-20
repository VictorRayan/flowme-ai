import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';

export async function requireBillingAdmin(req: NextRequest) {
  const auth = await requireAuth(req);
  const allowed = new Set((process.env.BILLING_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
  if (!allowed.has(auth.user.id)) throw new Error('FORBIDDEN');
  return auth;
}
