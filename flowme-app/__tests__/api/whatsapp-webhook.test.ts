import { NextRequest } from 'next/server';

jest.mock('@/lib/whatsapp/balys-runner', () => ({
  handleWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/whatsapp/webhook/route';
import { handleWhatsAppMessage } from '@/lib/whatsapp/balys-runner';

const makeWebhookReq = (body: object) =>
  new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts Evolution audio base64 from data.message.base64', async () => {
    const res = await POST(makeWebhookReq({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'audio-1',
          fromMe: false,
        },
        messageType: 'audioMessage',
        pushName: 'Victor',
        message: {
          audioMessage: {
            mimetype: 'audio/ogg; codecs=opus',
          },
          base64: 'data:audio/ogg;base64,T2dnUw==',
        },
      },
    }));

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
});
