const mockRequireFeature = jest.fn();

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';
    constructor(feature: string) { super('Feature requires Flow Me Pro'); this.name = 'FeatureLockedError'; this.feature = feature; }
  }
  return { FeatureLockedError, requireFeature: (...args: unknown[]) => mockRequireFeature(...args) };
});

const supabaseChain: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
};

const supabaseMock: any = {
  from: jest.fn().mockReturnValue(supabaseChain),
  rpc: jest.fn((name: string) => Promise.resolve(name === 'acquire_ai_usage_guard'
    ? { data: { allowed: true, lease_id: null }, error: null }
    : { data: null, error: null })),
  auth: {
    admin: {
      getUserById: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'victor@example.com' } } }),
    },
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => supabaseMock),
}));

jest.mock('@/lib/ai/balys-prompt', () => ({
  buildBalysSystemPrompt: jest.fn(() => 'system prompt'),
}));

jest.mock('@/lib/ai/calendar-skill', () => ({
  buildNowSystemPrompt: jest.fn(() => 'now'),
}));

jest.mock('@/lib/ai/notes-skill', () => ({
  buildNotesGraphMap: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/lib/ai/shadow-router', () => ({
  routeBalysRequest: jest.fn(() => ({
    executionPlan: 'direct_tool',
    executor: { provider: 'openai', model: 'gpt-5-mini' },
    planner: { provider: 'openai', model: 'gpt-5-mini' },
    gates: { maxAutoToolCalls: 5 },
    tier: 'cheap',
    userFacingLabel: 'Shadow Router',
  })),
}));

jest.mock('@/lib/ai/tools/registry', () => ({
  ALL_TOOLS: [],
  getActiveToolDomains: jest.fn(() => ['notes']),
}));

jest.mock('@/lib/ai/agent-loop', () => ({
  runBalysAgentLoop: jest.fn().mockResolvedValue({ content: 'Got it.' }),
}));

jest.mock('@/lib/ai/memory/profile', () => ({
  loadProfile: jest.fn().mockResolvedValue(null),
  renderProfileForPrompt: jest.fn(() => ''),
}));

jest.mock('@/lib/ai/memory/facts', () => ({
  loadTopFacts: jest.fn().mockResolvedValue([]),
  renderFactsForPrompt: jest.fn(() => ''),
  touchFacts: jest.fn(),
}));

jest.mock('@/lib/ai/prepare-messages', () => ({
  prepareMessagesWithAttachments: jest.fn().mockResolvedValue([{ role: 'user', content: 'daily briefing details from audio' }]),
}));

jest.mock('@/lib/ai/threads', () => ({
  ensureThread: jest.fn().mockResolvedValue({ id: 'thread-1' }),
  getThreadMessages: jest.fn().mockResolvedValue([]),
  persistMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
}));

jest.mock('@/lib/whatsapp/evolution-client', () => ({
  jidToPhone: jest.fn((jid: string) => jid.split('@')[0].replace(/\D/g, '')),
  sendText: jest.fn().mockResolvedValue(undefined),
}));

import { handleWhatsAppMessage } from '@/lib/whatsapp/balys-runner';
import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { getThreadMessages, persistMessage } from '@/lib/ai/threads';
import { sendText } from '@/lib/whatsapp/evolution-client';

describe('handleWhatsAppMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { whatsapp: true } });
  });

  it('stops before Balys execution for Free users', async () => {
    const { FeatureLockedError } = jest.requireMock('@/lib/billing/entitlements');
    mockRequireFeature.mockRejectedValueOnce(new FeatureLockedError('whatsapp'));

    await handleWhatsAppMessage({
      senderJid: '5511999999999@s.whatsapp.net',
      messageId: 'free-1',
      messageType: 'conversation',
      text: 'Oi Balys',
      hasMedia: false,
    });

    expect(sendText).toHaveBeenCalledWith('5511999999999@s.whatsapp.net', expect.stringContaining('Flow Me Pro'));
    expect(runBalysAgentLoop).not.toHaveBeenCalled();
  });

  it('persists WhatsApp voice notes with audio metadata and transcript', async () => {
    await handleWhatsAppMessage({
      senderJid: '5511999999999@s.whatsapp.net',
      messageId: 'audio-1',
      messageType: 'audioMessage',
      text: '',
      hasMedia: true,
      mediaBase64: 'T2dnUw==',
      mediaMimetype: 'audio/ogg; codecs=opus',
      pushName: 'Victor',
    });

    expect(persistMessage).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.objectContaining({
      role: 'user',
      content: 'daily briefing details from audio',
      transcript: 'daily briefing details from audio',
      attachments: [
        expect.objectContaining({
          type: 'audio',
          name: 'audio.ogg',
          mimeType: 'audio/ogg; codecs=opus',
        }),
      ],
    }));
  });

  it('loads prior WhatsApp thread messages before calling Balys', async () => {
    (getThreadMessages as jest.Mock).mockResolvedValueOnce([
      {
        role: 'user',
        content: 'O que tem na minha caixa de entrada hoje?',
      },
      {
        role: 'assistant',
        content: 'Você tem uma mensagem de Tom from LOVO.',
        thinking: [{
          tool: 'gmail.search_messages',
          status: 'ok',
          receipt: {
            messages: [{
              id: 'msg-1',
              threadId: 'thread-1',
              subject: 'Your free Genny trial ends today',
              from: 'Tom from LOVO',
              date: 'today',
              snippet: 'Your trial ends today',
            }],
            count: 1,
          },
        }],
      },
    ]);

    await handleWhatsAppMessage({
      senderJid: '5511999999999@s.whatsapp.net',
      messageId: 'text-1',
      messageType: 'conversation',
      text: 'O que tem no conteúdo do email?',
      hasMedia: false,
      pushName: 'Victor',
    });

    expect(runBalysAgentLoop).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: 'Você tem uma mensagem de Tom from LOVO.' }),
        expect.objectContaining({ role: 'user', content: 'O que tem no conteúdo do email?' }),
      ]),
      requiredFirstTool: undefined,
      context: expect.objectContaining({ preferredConnectorType: 'gmail' }),
    }));
  });

  it('sends a reconnect CTA when a connector action fails on WhatsApp', async () => {
    (runBalysAgentLoop as jest.Mock).mockImplementationOnce(async (args: any) => {
      args.onProgress?.({
        type: 'tool_call_start',
        call_id: 'call-1',
        tool: 'connectors.search_docs',
        args: {},
      });
      args.onProgress?.({
        type: 'tool_call_end',
        call_id: 'call-1',
        tool: 'connectors.search_docs',
        ok: false,
        error: 'Google Drive connection needs reconnect. The Google account token does not include the permission needed for this action',
      });
      return { content: 'Abra Connectors.' };
    });

    await handleWhatsAppMessage({
      senderJid: '5511999999999@s.whatsapp.net',
      messageId: 'reconnect-1',
      messageType: 'conversation',
      text: 'o que tem no meu drive?',
      hasMedia: false,
      pushName: 'Victor',
    });

    expect(sendText).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
      expect.stringContaining('/app/connectors'),
    );
    expect(sendText).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
      expect.stringContaining('Reconectar conta'),
    );
  });
});
