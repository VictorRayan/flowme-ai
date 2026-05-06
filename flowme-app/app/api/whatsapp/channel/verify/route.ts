import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/** POST — verify the 6-digit code and activate the channel. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);

  const body = await request.json().catch(() => ({}));
  const code: string = (body?.code ?? '').trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Provide a 6-digit verification code.', 400);
  }

  const { data: channel } = await supabase
    .from('whatsapp_channels')
    .select('id, verification_code, code_expires_at, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!channel) {
    return apiError(ErrorCode.NOT_FOUND, 'No pending WhatsApp channel found. Register your number first.', 404);
  }

  if (channel.status === 'active') {
    return apiSuccess({ already_active: true });
  }

  if (new Date(channel.code_expires_at) < new Date()) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Verification code expired. Please request a new one.', 410);
  }

  if (channel.verification_code !== code) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Incorrect verification code.', 400);
  }

  const { error } = await supabase
    .from('whatsapp_channels')
    .update({
      status: 'active',
      verification_code: null,
      code_expires_at: null,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', channel.id);

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);

  return apiSuccess({ verified: true });
}
