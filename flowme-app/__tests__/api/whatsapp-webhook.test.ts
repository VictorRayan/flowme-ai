import { NextRequest } from 'next/server';

jest.mock('@/lib/whatsapp/balys-runner', () => ({
  handleWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn() }));

import { POST } from '@/app/api/whatsapp/webhook/route';
import { handleWhatsAppMessage } from '@/lib/whatsapp/balys-runner';
import { getSupabaseAdmin } from '@/lib/api/admin';

const makeWebhookReq = (body: object, secret = 'local-webhook-secret') =>
  new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-flowme-webhook-secret': secret },
    body: JSON.stringify(body),
  });

const audioEvent = {
  event: 'messages.upsert',
  data: {
    key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'audio-1', fromMe: false },
    messageType: 'audioMessage', pushName: 'Demo User',
    message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus' }, base64: 'data:audio/ogg;base64,T2dnUw==' },
  },
};

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVOLUTION_WEBHOOK_SECRET = 'local-webhook-secret';
    const query: any = { eq: jest.fn().mockReturnThis() };
    query.update = jest.fn().mockReturnValue(query);
    query.then = (resolve: Function) => Promise.resolve({ error: null }).then(resolve as any);
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: 'claimed', error: null }),
      from: jest.fn().mockReturnValue(query),
    });
  });

  it('extracts Evolution audio base64 from data.message.base64', async () => {
    const res = await POST(makeWebhookReq(audioEvent));

    expect(res.status).toBe(200);
    expect(handleWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
      senderJid: '5511999999999@s.whatsapp.net',
      messageId: 'audio-1',
      messageType: 'audioMessage',
      hasMedia: true,
      mediaBase64: 'T2dnUw==',
      mediaMimetype: 'audio/ogg; codecs=opus',
    }));
  });

  it('rejects missing configuration, wrong headers, and old query-string secrets', async () => {
    expect((await POST(makeWebhookReq(audioEvent, 'wrong'))).status).toBe(401);
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    expect((await POST(makeWebhookReq(audioEvent))).status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('does not process a duplicate message', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ rpc: jest.fn().mockResolvedValue({ data: 'processed', error: null }) });
    const res = await POST(makeWebhookReq(audioEvent));
    expect(res.status).toBe(200);
    expect(handleWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('asks the provider to retry an in-progress message', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ rpc: jest.fn().mockResolvedValue({ data: 'in_progress', error: null }) });
    const res = await POST(makeWebhookReq(audioEvent));
    expect(res.status).toBe(503);
    expect(handleWhatsAppMessage).not.toHaveBeenCalled();
  });
});
