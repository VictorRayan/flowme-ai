import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { cleanupBadGeneratedPeople, ensureSelfPerson, resolveSelfIdentity } from '@/lib/ai/memory/self';

// GET /api/people/myself — get or create the current user's self-person.
// This is SaaS-safe: "myself" resolves to the authenticated user's own display name,
// not a literal "Myself" contact.
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const self = resolveSelfIdentity(user);
  const result = await ensureSelfPerson(supabase, user.id, self);

  if (!result.ok || !result.person) return apiError(ErrorCode.INTERNAL_ERROR, result.error || 'Failed to resolve self person');
  return NextResponse.json(result.person);
}

// POST /api/people/myself — cleanup legacy bad generated people for this user.
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const self = resolveSelfIdentity(user);
  const selfResult = await ensureSelfPerson(supabase, user.id, self);
  if (!selfResult.ok) return apiError(ErrorCode.INTERNAL_ERROR, selfResult.error || 'Failed to resolve self person');

  const cleanup = await cleanupBadGeneratedPeople(supabase, user.id);
  return NextResponse.json({ self: selfResult.person, cleanup });
}
