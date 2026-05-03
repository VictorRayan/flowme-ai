import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { resolveSelfIdentity } from '@/lib/ai/memory/self';

// GET /api/people
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  let query = supabase
    .from('people')
    .select('id, name, email, avatar_url')
    .eq('user_id', user.id)
    .order('name');

  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  const self = resolveSelfIdentity(user);
  return NextResponse.json((data || []).map((person: { id: string; name: string; email?: string | null; avatar_url?: string | null }) => ({
    ...person,
    is_self: Boolean(
      (self.email && person.email === self.email)
      || person.name.toLowerCase() === self.name.toLowerCase()
      || person.name === 'Myself'
    ),
  })));
}

// POST /api/people
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { name, email } = await request.json();

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('people')
    .upsert({ user_id: user.id, name, email }, { onConflict: 'user_id,name' })
    .select('id, name, email')
    .single();

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json(data, { status: 201 });
}
