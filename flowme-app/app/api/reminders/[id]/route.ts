import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { cancelReminder, updateReminder } from '@/lib/reminders/reminders';
import type { ReminderChannelPreference } from '@/lib/reminders/types';

const VALID_CHANNELS: ReminderChannelPreference[] = ['default', 'whatsapp', 'instagram', 'push'];

function isChannel(value: unknown): value is ReminderChannelPreference {
  return typeof value === 'string' && VALID_CHANNELS.includes(value as ReminderChannelPreference);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body || Object.keys(body).length === 0) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update', 400);
  }
  if (body.channel_preference !== undefined && !isChannel(body.channel_preference)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid channel_preference', 400);
  }

  try {
    const reminder = await updateReminder(supabase, user.id, id, {
      message: body.message,
      scheduled_for: body.scheduled_for,
      timezone: body.timezone,
      channel_preference: body.channel_preference,
    });
    return apiSuccess({ reminder });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update reminder';
    return apiError(ErrorCode.VALIDATION_ERROR, message, 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAuth(request);
  const { id } = await params;

  try {
    await cancelReminder(supabase, user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel reminder';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

