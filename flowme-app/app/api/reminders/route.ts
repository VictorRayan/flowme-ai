import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { createReminder, listReminders } from '@/lib/reminders/reminders';
import type { ReminderChannelPreference, ReminderStatus } from '@/lib/reminders/types';

const VALID_STATUSES: ReminderStatus[] = ['scheduled', 'sent', 'cancelled', 'failed'];
const VALID_CHANNELS: ReminderChannelPreference[] = ['default', 'whatsapp', 'instagram', 'push'];

function isStatus(value: string | null): value is ReminderStatus {
  return Boolean(value && VALID_STATUSES.includes(value as ReminderStatus));
}

function isChannel(value: unknown): value is ReminderChannelPreference {
  return typeof value === 'string' && VALID_CHANNELS.includes(value as ReminderChannelPreference);
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  if (status && !isStatus(status)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid reminder status', 400);
  }
  const requestedStatus: ReminderStatus = isStatus(status) ? status : 'scheduled';

  try {
    const reminders = await listReminders(supabase, user.id, {
      status: requestedStatus,
      source_type: searchParams.get('source_type') === 'calendar_event' ? 'calendar_event' : undefined,
      source_id: searchParams.get('source_id') || undefined,
      start_iso: searchParams.get('start_iso') || undefined,
      end_iso: searchParams.get('end_iso') || undefined,
      limit: Number(searchParams.get('limit') || 50),
    });
    return apiSuccess({ reminders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list reminders';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const body = await request.json().catch(() => ({}));

  if (!body?.message?.trim()) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'message is required', 400);
  }
  if (!body?.scheduled_for || Number.isNaN(new Date(body.scheduled_for).getTime())) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'scheduled_for must be a valid ISO datetime', 400);
  }
  if (body.channel_preference && !isChannel(body.channel_preference)) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid channel_preference', 400);
  }

  try {
    const reminder = await createReminder(supabase, user.id, {
      title: body.title,
      message: body.message,
      scheduled_for: body.scheduled_for,
      timezone: body.timezone,
      channel_preference: body.channel_preference || 'default',
      source: body.source || null,
      created_by: 'user',
      dedupe_key: body.dedupe_key || null,
    });
    return apiSuccess({ reminder });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create reminder';
    return apiError(ErrorCode.VALIDATION_ERROR, message, 400);
  }
}
