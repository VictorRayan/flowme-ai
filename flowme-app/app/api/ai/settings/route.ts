import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const VALID_COUNCIL_MODES = ['cheap', 'best'] as const;
type CouncilMode = typeof VALID_COUNCIL_MODES[number];

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);

    const { data, error } = await supabase
      .from('user_settings')
      .select('council_mode, memory_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    return apiSuccess({
      council_mode: (data?.council_mode as CouncilMode) || 'cheap',
      memory_enabled: data?.memory_enabled ?? true,
    });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[ai/settings GET] Internal Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (body.council_mode !== undefined) {
      if (!VALID_COUNCIL_MODES.includes(body.council_mode)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `council_mode must be one of: ${VALID_COUNCIL_MODES.join(', ')}`);
      }
      update.council_mode = body.council_mode;
    }
    if (body.memory_enabled !== undefined) {
      if (typeof body.memory_enabled !== 'boolean') {
        return apiError(ErrorCode.VALIDATION_ERROR, 'memory_enabled must be boolean');
      }
      update.memory_enabled = body.memory_enabled;
    }

    if (Object.keys(update).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'no updatable fields provided');
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...update, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) {
      console.error('[ai/settings PATCH] upsert error:', error);
      return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }

    return apiSuccess({ ok: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[ai/settings PATCH] Internal Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
