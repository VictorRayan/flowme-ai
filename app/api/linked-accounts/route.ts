import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();

    // Fetch accounts with a left join to check if Google tokens exist
    const { data: accounts, error } = await supabase
      .from('linked_accounts')
      .select('id, name, type, is_active, provider, user_google_tokens(linked_account_id)')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Map to include google_connected flag
    const enriched = (accounts || []).map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      is_active: acc.is_active,
      provider: acc.provider,
      google_connected: Array.isArray(acc.user_google_tokens)
        ? acc.user_google_tokens.length > 0
        : !!acc.user_google_tokens,
    }));

    return apiSuccess({ accounts: enriched, userEmail: user.email });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/linked-accounts error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch linked accounts', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();

    const { name, type } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Name must be at least 2 characters');
    }
    if (type !== 'work' && type !== 'personal') {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Type must be "work" or "personal"');
    }

    const { data: account, error } = await supabase
      .from('linked_accounts')
      .insert({
        user_id: user.id,
        name: name.trim(),
        type,
        provider: 'google', // Default provider for now
      })
      .select('id, name, type, is_active, provider')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return apiError(ErrorCode.VALIDATION_ERROR, 'You already have an account with this name');
      }
      throw error;
    }

    return apiSuccess({ account });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/linked-accounts error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
