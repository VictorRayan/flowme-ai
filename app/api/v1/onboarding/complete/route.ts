import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const { morningTime, eveningTime } = body;

    if (!morningTime || !eveningTime) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Missing morningTime or eveningTime');
    }

    // Upsert user settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        morning_rhythm_time: morningTime,
        evening_rhythm_time: eveningTime,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Onboarding Complete API] Upsert Error:', error);
      return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }

    return apiSuccess({ success: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[Onboarding Complete API] Internal Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
