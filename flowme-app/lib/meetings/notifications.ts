// Web push notifications fired by the meeting pipeline.
// Keep this tiny and pure; the sender is injected so tests can verify the
// payload without touching VAPID env.

import { sendWebPush, type WebPushPayload } from '@/lib/web-push/send';

interface SupabaseLike { from(table: string): any }

export type MeetingNotificationKind = 'ready' | 'failed' | 'reanalyzed';

export interface NotifyOptions {
  supabase: SupabaseLike;
  userId: string;
  meetingId: string;
  title: string;
  kind: MeetingNotificationKind;
  failedStage?: string | null;
  sender?: typeof sendWebPush;
}

export function buildMeetingNotification(opts: { kind: MeetingNotificationKind; meetingId: string; title: string; failedStage?: string | null }): WebPushPayload {
  const safeTitle = (opts.title || 'Reunião').slice(0, 80);
  if (opts.kind === 'ready') {
    return {
      title: `${safeTitle} pronta para revisão`,
      body: 'Toque para revisar falantes e finalizar.',
      url: `/app/notes/meetings/${opts.meetingId}/finalize`,
    };
  }
  if (opts.kind === 'reanalyzed') {
    return {
      title: `${safeTitle} reanalisada`,
      body: 'Aplicamos sua correção. Toque para revisar de novo.',
      url: `/app/notes/meetings/${opts.meetingId}/finalize`,
    };
  }
  return {
    title: `${safeTitle} precisa da sua atenção`,
    body: `Algo falhou${opts.failedStage ? ` no estágio "${opts.failedStage}"` : ''}. Seu áudio está salvo — toque para tentar de novo.`,
    url: `/app/notes/meetings/${opts.meetingId}/finalize`,
  };
}

export async function notifyMeetingProcessed(opts: NotifyOptions): Promise<{ ok: boolean }> {
  const payload = buildMeetingNotification({
    kind: opts.kind,
    meetingId: opts.meetingId,
    title: opts.title,
    failedStage: opts.failedStage ?? null,
  });
  const sender = opts.sender || sendWebPush;
  try {
    await sender(opts.supabase, opts.userId, payload);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
