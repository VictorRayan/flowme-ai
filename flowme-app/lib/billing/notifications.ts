import type { SupabaseClient } from '@supabase/supabase-js';
import { dispatchMobilePush, type MobilePushPayload } from '@/lib/mobile-push/send';
import { sendWebPush } from '@/lib/web-push/send';
import { sendText } from '@/lib/whatsapp/evolution-client';

export type BillingNotificationKind = 'payment_failed' | 'payment_action_required' | 'invoice_finalization_failed';

type ChannelState = 'sent' | 'unavailable' | 'retry';
type ChannelResults = Record<string, { state: ChannelState; error?: string }>;

export type BillingNotificationDelivery = {
  id: string;
  userId: string;
  kind: BillingNotificationKind;
  provider: 'stripe' | 'apple' | 'google';
  attempts: number;
  channelResults: ChannelResults;
};

type DeliveryDependencies = {
  sendWeb: typeof sendWebPush;
  sendMobile: typeof dispatchMobilePush;
  sendWhatsapp: typeof sendText;
};

export function billingNotificationContent(kind: BillingNotificationKind, provider: BillingNotificationDelivery['provider']): MobilePushPayload {
  const management = provider === 'apple' ? 'na App Store' : provider === 'google' ? 'no Google Play' : 'nas configurações';
  if (kind === 'payment_action_required') {
    return {
      title: 'Confirme o pagamento do Flow Me Pro',
      body: `Seu banco pediu uma confirmação. Atualize ou confirme o pagamento ${management}.`,
      url: '/app/settings?billing=payment_action_required',
    };
  }
  if (kind === 'invoice_finalization_failed') {
    return {
      title: 'Sua cobrança precisa de atenção',
      body: `Não foi possível preparar sua renovação. Confira sua assinatura ${management}.`,
      url: '/app/settings?billing=payment_failed',
    };
  }
  return {
    title: 'Não conseguimos renovar seu Flow Me Pro',
    body: `Atualize sua forma de pagamento ${management} para manter seu acesso.`,
    url: '/app/settings?billing=payment_failed',
  };
}

async function whatsappPhone(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('whatsapp_channels')
    .select('phone')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.phone || null;
}

export async function createBillingNotification(
  admin: SupabaseClient,
  input: Omit<BillingNotificationDelivery, 'id' | 'attempts' | 'channelResults'> & { metadata?: Record<string, unknown> },
): Promise<BillingNotificationDelivery> {
  const { data, error } = await admin.from('billing_notifications').insert({
    user_id: input.userId,
    kind: input.kind,
    provider: input.provider,
    status: 'pending',
    metadata: input.metadata || {},
  }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'Failed to create billing notification');
  return { id: data.id, userId: input.userId, kind: input.kind, provider: input.provider, attempts: 0, channelResults: {} };
}

export async function claimBillingNotifications(admin: SupabaseClient, limit = 20): Promise<BillingNotificationDelivery[]> {
  const { data, error } = await admin.rpc('claim_billing_notifications', { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data || []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.id),
    userId: String(row.user_id),
    kind: row.kind as BillingNotificationKind,
    provider: row.provider as BillingNotificationDelivery['provider'],
    attempts: Number(row.attempts || 0),
    channelResults: (row.channel_results || {}) as ChannelResults,
  }));
}

function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempts - 1)));
}

export async function deliverBillingNotification(
  admin: SupabaseClient,
  input: BillingNotificationDelivery,
  dependencies: DeliveryDependencies = { sendWeb: sendWebPush, sendMobile: dispatchMobilePush, sendWhatsapp: sendText },
): Promise<{ status: 'pending' | 'sent' | 'failed'; channels: string[]; channelResults: ChannelResults }> {
  const content = billingNotificationContent(input.kind, input.provider);
  const channelResults: ChannelResults = { ...input.channelResults };

  if (channelResults.web_push?.state !== 'sent' && channelResults.web_push?.state !== 'unavailable') {
    const web = await dependencies.sendWeb(admin, input.userId, content).catch(error => ({ ok: false, error: error instanceof Error ? error.message : 'Web Push failed' }));
    channelResults.web_push = web.ok
      ? { state: 'sent' }
      : web.error === 'no subscriptions' || web.error === 'vapid not configured'
        ? { state: 'unavailable', error: web.error }
        : { state: 'retry', error: web.error || 'Web Push delivery failed' };
  }

  if (channelResults.mobile_push?.state !== 'sent' && channelResults.mobile_push?.state !== 'unavailable') {
    const mobile = await dependencies.sendMobile(admin, input.userId, content).catch(() => ({ attempted: 1, delivered: 0 }));
    channelResults.mobile_push = mobile.delivered > 0
      ? { state: 'sent' }
      : mobile.attempted === 0
        ? { state: 'unavailable' }
        : { state: 'retry', error: 'Mobile push delivery failed' };
  }

  if (channelResults.whatsapp?.state !== 'sent' && channelResults.whatsapp?.state !== 'unavailable') {
    const phone = await whatsappPhone(admin, input.userId);
    if (!phone) {
      channelResults.whatsapp = { state: 'unavailable' };
    } else {
      try {
        await dependencies.sendWhatsapp(phone, `${content.title}. ${content.body}`);
        channelResults.whatsapp = { state: 'sent' };
      } catch (error) {
        channelResults.whatsapp = { state: 'retry', error: error instanceof Error ? error.message : 'WhatsApp delivery failed' };
      }
    }
  }

  const attempts = input.attempts + 1;
  const retrying = Object.values(channelResults).some(result => result.state === 'retry');
  const status = retrying ? (attempts >= 5 ? 'failed' : 'pending') : 'sent';
  const errors = Object.entries(channelResults)
    .filter(([, result]) => result.state === 'retry')
    .map(([channel, result]) => `${channel}: ${result.error || 'delivery failed'}`);
  const update = {
    status,
    attempts,
    channels_attempted: Object.keys(channelResults),
    channel_results: channelResults,
    last_error: errors.join('; ') || null,
    next_attempt_at: status === 'pending' ? new Date(Date.now() + retryDelayMs(attempts)).toISOString() : new Date().toISOString(),
    processing_started_at: null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('billing_notifications').update(update).eq('id', input.id).eq('status', 'pending');
  if (error) throw new Error(error.message);
  return { status, channels: Object.keys(channelResults), channelResults };
}

export async function clearBillingFailureNotifications(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('billing_notifications').update({ status: 'dismissed' })
    .eq('user_id', userId)
    .in('kind', ['payment_failed', 'payment_action_required', 'invoice_finalization_failed'])
    .in('status', ['pending', 'sent', 'failed']);
  if (error) throw new Error(error.message);
}
