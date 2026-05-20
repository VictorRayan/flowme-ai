import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { sendVerificationCode } from '@/lib/whatsapp/evolution-client';

const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

function normalizePhone(raw: string): string {
  // Strip all non-digits, keep E.164 digits only (no leading +)
  return raw.replace(/\D/g, '');
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** GET — return current channel status for the authenticated user. */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);

  const { data, error } = await supabase
    .from('whatsapp_channels')
    .select('id, phone, status, verified_at, reminders_enabled, is_default_reminder_channel, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);

  return apiSuccess({ channel: data ?? null });
}

/** POST — register a phone number and send a verification code. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);

  const body = await request.json().catch(() => ({}));
  const rawPhone: string = (body?.phone ?? '').trim();

  if (!rawPhone || !PHONE_RE.test(rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid phone number. Provide a valid international number.', 400);
  }

  const phone = normalizePhone(rawPhone);
  const code  = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Upsert: if the user already has a channel (e.g. they want to re-verify), replace it.
  const { error: upsertError } = await supabase
    .from('whatsapp_channels')
    .upsert(
      {
        user_id: user.id,
        phone,
        status: 'pending_verification',
        reminders_enabled: body?.reminders_enabled !== false,
        is_default_reminder_channel: body?.is_default_reminder_channel !== false,
        verification_code: code,
        code_expires_at: expiresAt,
        verified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    if (upsertError.message.includes('whatsapp_channels_phone_unique')) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'This phone number is already registered to another account.', 409);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, upsertError.message);
  }

  try {
    await sendVerificationCode(phone, code);
  } catch (e: any) {
    // Roll back to avoid a stuck pending state
    await supabase.from('whatsapp_channels').delete().eq('user_id', user.id);
    return apiError(ErrorCode.INTERNAL_ERROR, `Failed to send WhatsApp code: ${e.message}`);
  }

  return apiSuccess({ sent: true, phone, expires_at: expiresAt });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, boolean | string> = { updated_at: new Date().toISOString() };

  if (typeof body?.reminders_enabled === 'boolean') {
    patch.reminders_enabled = body.reminders_enabled;
  }
  if (typeof body?.is_default_reminder_channel === 'boolean') {
    patch.is_default_reminder_channel = body.is_default_reminder_channel;
  }

  if (Object.keys(patch).length === 1) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'No channel settings to update', 400);
  }

  const { error } = await supabase
    .from('whatsapp_channels')
    .update(patch)
    .eq('user_id', user.id);

  if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message);
  return apiSuccess({ updated: true });
}

/** DELETE — remove the user's WhatsApp channel. */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);

  await supabase.from('whatsapp_channels').delete().eq('user_id', user.id);

  return apiSuccess({ ok: true, deleted: true });
}
