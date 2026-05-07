import { NextRequest, NextResponse } from 'next/server';
import { handleWhatsAppMessage, WhatsAppIncomingMessage } from '@/lib/whatsapp/balys-runner';

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

/**
 * Evolution API calls this endpoint on every incoming message.
 * We return 200 immediately and run Balys asynchronously so Evolution
 * doesn't time out and retry.
 */
export async function POST(request: NextRequest) {
  // Verify the shared secret Evolution sends as ?secret= in the URL
  if (WEBHOOK_SECRET) {
    const incomingSecret = request.nextUrl.searchParams.get('secret') ?? '';
    if (incomingSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

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

  const fromMe: boolean   = data?.key?.fromMe ?? false;
  const senderJid: string = data?.key?.remoteJid ?? '';
  const messageId: string = data?.key?.id ?? '';
  const messageType: string = data?.messageType ?? 'conversation';
  const pushName: string  = data?.pushName ?? '';

  // Ignore messages sent by the instance itself and group messages
  if (fromMe || !senderJid || senderJid.endsWith('@g.us')) {
    return NextResponse.json({ ok: true, ignored: true });
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

  // Fire-and-forget: respond 200 immediately, process in background
  void handleWhatsAppMessage(incoming).catch((e) =>
    console.error('[whatsapp-webhook] handleWhatsAppMessage threw:', e),
  );

  return NextResponse.json({ ok: true });
}
