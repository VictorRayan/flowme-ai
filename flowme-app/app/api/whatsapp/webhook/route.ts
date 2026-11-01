import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { handleWhatsAppMessage, WhatsAppIncomingMessage } from '@/lib/whatsapp/balys-runner';

function authorized(request: NextRequest): boolean {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  const provided = request.headers.get('x-flowme-webhook-secret');
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Evolution API calls this endpoint on every incoming message.
 * Authenticated events are claimed by provider message ID before processing.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // Evolution webhook payload shape (v2):
  // { event: "messages.upsert", data: { key: { remoteJid, id, fromMe }, message: {...}, messageType, pushName } }
  const event = body?.event as string | undefined;

  if (event !== 'messages.upsert') {
    // Ignore connection events, QR codes, etc.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const data = body?.data;
  if (!data) return NextResponse.json({ ok: true, ignored: true });

  const fromMe = data?.key?.fromMe === true;
  const senderJid = typeof data?.key?.remoteJid === 'string' ? data.key.remoteJid : '';
  const messageId = typeof data?.key?.id === 'string' ? data.key.id : '';
  const messageType = typeof data?.messageType === 'string' ? data.messageType : 'conversation';
  const pushName = typeof data?.pushName === 'string' ? data.pushName : '';

  // Ignore messages sent by the instance itself and group messages
  if (fromMe || !senderJid || senderJid.endsWith('@g.us')) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!messageId || messageId.length > 255) {
    return NextResponse.json({ ok: false, error: 'invalid message id' }, { status: 400 });
  }

  // Extract text from the different message types Evolution sends
  const msg = data?.message ?? {};
  const text: string =
    msg?.conversation ??
    msg?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ??
    msg?.videoMessage?.caption ??
    msg?.documentMessage?.caption ??
    '';

  // When "Webhook Base64" is enabled, Evolution may place base64 either
  // inside the typed node or beside it as data.message.base64.
  const MEDIA_TYPES = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage', 'stickerMessage'] as const;
  const hasMedia = MEDIA_TYPES.includes(messageType as any);

  let mediaBase64: string | undefined;
  let mediaMimetype: string | undefined;
  if (hasMedia && msg[messageType]) {
    const mediaNode = msg[messageType];
    const rawBase64 = mediaNode?.base64 ?? msg?.base64 ?? data?.base64;
    mediaBase64 = typeof rawBase64 === 'string'
      ? rawBase64.replace(/^data:[^,]+;base64,/, '')
      : undefined;
    mediaMimetype =
      mediaNode?.mimetype ??
      mediaNode?.mediaType ??
      msg?.mimetype ??
      data?.mimetype ??
      (messageType === 'audioMessage' ? 'audio/ogg' : undefined);
  }

  const incoming: WhatsAppIncomingMessage = {
    senderJid,
    messageId,
    messageType: messageType as WhatsAppIncomingMessage['messageType'],
    text,
    hasMedia,
    mediaBase64,
    mediaMimetype,
    pushName,
  };

  try {
    const admin = getSupabaseAdmin();
    const { data: claim, error } = await admin.rpc('claim_inbound_message', {
      p_source: 'evolution', p_sender_id: senderJid, p_message_id: messageId,
    });
    if (error) throw error;
    if (claim === 'processed') return NextResponse.json({ ok: true, duplicate: true });
    if (claim === 'in_progress') return NextResponse.json({ ok: false, retry: true }, { status: 503 });
    if (claim !== 'claimed') throw new Error('Invalid inbound claim status');

    await handleWhatsAppMessage(incoming);
    const { error: markError } = await admin.from('inbound_message_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('source', 'evolution').eq('sender_id', senderJid).eq('message_id', messageId);
    if (markError) throw markError;
  } catch (error) {
    console.error('[whatsapp-webhook] processing failed:', error);
    return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
