import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start and end query parameters are required');
    }

    // A valid ISO string check could be done here, but Supabase handles timestamptz gracefully
    const { data: microactivities, error } = await supabase
      .from('microactivities')
      .select('id, title, description, start_at, end_at')
      .eq('user_id', user.id)
      .gte('start_at', start)
      .lt('start_at', end)
      .order('start_at', { ascending: true });

    if (error) throw error;

    return apiSuccess({ microactivities: microactivities || [] });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/microactivities error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch microactivities', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();
    const { title, description, start_at, end_at } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Title is required');
    }
    if (!start_at) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start_at is required');
    }

    if (end_at && new Date(end_at) <= new Date(start_at)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'end_at must be strictly greater than start_at');
    }

    const { data: microactivity, error } = await supabase
      .from('microactivities')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        start_at,
        end_at: end_at || null,
      })
      .select('id, title, description, start_at, end_at')
      .single();

    if (error) throw error;

    return apiSuccess({ microactivity });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/microactivities error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
