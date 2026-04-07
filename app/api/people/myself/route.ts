import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

// GET /api/people/myself — get or create the "Myself" person for the current user
export async function GET(_request: NextRequest) {
  const { supabase, user } = await requireAuth();

  // Try to find existing "Myself" person
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, email')
    .eq('user_id', user.id)
    .eq('name', 'Myself')
    .single();

  if (existing) return NextResponse.json(existing);

  // Create it
  const { data: created, error } = await supabase
    .from('people')
    .insert({ user_id: user.id, name: 'Myself' })
    .select('id, name, email')
    .single();

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return NextResponse.json(created);
}
