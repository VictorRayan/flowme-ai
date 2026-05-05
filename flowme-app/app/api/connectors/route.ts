import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const VALID_TYPES = ['gmail', 'google_docs', 'google_sheets', 'google_drive'];

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);

    const { data, error } = await supabase
      .from('connectors')
      .select('id, name, type, is_active, config, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return apiSuccess({ connectors: data || [] });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/connectors error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch connectors', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const { name, type, config } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Name must be at least 2 characters');
    }
    if (!VALID_TYPES.includes(type)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `Type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('connectors')
      .insert({
        user_id: user.id,
        name: name.trim(),
        type,
        config: config || {},
      })
      .select('id, name, type, is_active, config, created_at')
      .single();

    if (error) throw error;

    return apiSuccess({ connector: data });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/connectors error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create connector', 500);
  }
}
