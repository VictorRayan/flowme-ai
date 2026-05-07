const supabaseChain: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
};

const supabaseMock: any = {
  from: jest.fn().mockReturnValue(supabaseChain),
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
  persistMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
}));

jest.mock('@/lib/whatsapp/evolution-client', () => ({
  jidToPhone: jest.fn((jid: string) => jid.split('@')[0].replace(/\D/g, '')),
  sendText: jest.fn().mockResolvedValue(undefined),
}));

import { handleWhatsAppMessage } from '@/lib/whatsapp/balys-runner';
import { persistMessage } from '@/lib/ai/threads';

describe('handleWhatsAppMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
