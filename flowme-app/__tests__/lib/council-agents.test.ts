const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

import { councilMembers, runAiCouncilPipeline } from '@/lib/ai/council-agents';
import OpenAI from 'openai';

const MockOpenAI = OpenAI as unknown as jest.Mock;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

function mockCompletion(content: string) {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

describe('runAiCouncilPipeline', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'openai-key-that-must-not-be-used';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    MockOpenAI.mockClear();
    mockCreate.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it('keeps cheap mode as a single advisor round plus CEO', async () => {
    mockCreate.mockImplementation(async (request: any) => {
      const system = request.messages?.[0]?.content || '';
      if (system.includes('CEO Consolidator')) {
        return mockCompletion('A direct CEO directive.');
      }
      return mockCompletion('Advisor recommendation.');
    });

    const events: any[] = [];
    const result = await runAiCouncilPipeline('Should I take the offer?', {
      mode: 'cheap',
      onProgress: (event) => events.push(event),
    });

    expect(result.councilMode).toBe('cheap');
    expect(result.roundsRun).toBe(1);
    expect(result.finalMode).toBe('verdict');
    expect(result.individualAdvice).toHaveLength(councilMembers.length);
    expect(result.ceoDirective).toBe('A direct CEO directive.');
    expect(events.some((e) => e.tool === 'council.round_1')).toBe(true);
    expect(events.some((e) => e.tool === 'council.round_2')).toBe(false);
    for (const [config] of MockOpenAI.mock.calls) {
      expect(config).toMatchObject({
        apiKey: 'test-gemini-key',
        baseURL: GEMINI_BASE_URL,
      });
      expect(config.apiKey).not.toBe('openai-key-that-must-not-be-used');
    }
  });

  it('runs refinement and cross-examination in best mode when CEO continues', async () => {
    mockCreate.mockImplementation(async (request: any) => {
      const system = request.messages?.[0]?.content || '';
      if (system.includes('Decide whether this council needs')) {
        return mockCompletion('CONTINUE: unresolved tradeoffs remain.');
      }
      if (system.includes('CEO Moderator')) {
        return mockCompletion('MODE: plan\nDIRECTIVE:\nNegotiate before deciding.');
      }
      return mockCompletion('Advisor debate note.');
    });

    const events: any[] = [];
    const result = await runAiCouncilPipeline('Should I stay six months or take a better role?', {
      mode: 'best',
      onProgress: (event) => events.push(event),
    });

    expect(result.councilMode).toBe('best');
    expect(result.roundsRun).toBe(3);
    expect(result.finalMode).toBe('plan');
    expect(result.ceoDirective).toBe('Negotiate before deciding.');
    expect(result.transcript.filter((entry) => entry.phase === 'cross_examination')).toHaveLength(councilMembers.length);
    expect(events.some((e) => e.tool === 'council.round_2')).toBe(true);
    expect(events.some((e) => e.tool === 'council.cross_examination')).toBe(true);
    expect(events.some((e) => e.tool === 'council.voice' && e.receipt?.status === 'council_voice')).toBe(true);
  });

  it('lets the CEO stop best mode after round 2 when alignment is strong', async () => {
    mockCreate.mockImplementation(async (request: any) => {
      const system = request.messages?.[0]?.content || '';
      if (system.includes('Decide whether this council needs')) {
        return mockCompletion('STOP: the advisors agree.');
      }
      if (system.includes('CEO Moderator')) {
        return mockCompletion('MODE: verdict\nDIRECTIVE:\nStay and renegotiate clearly.');
      }
      return mockCompletion('Advisor aligned note.');
    });

    const result = await runAiCouncilPipeline('Should I keep my promise?', { mode: 'best' });

    expect(result.roundsRun).toBe(2);
    expect(result.finalMode).toBe('verdict');
    expect(result.transcript.some((entry) => entry.phase === 'cross_examination')).toBe(false);
  });

  it('does not expose provider quota errors as advisor advice', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockImplementation(async (request: any) => {
      const system = request.messages?.[0]?.content || '';
      if (system.includes('cash-printing machine')) {
        throw new Error('429 You exceeded your current quota. https://platform.openai.com/docs/guides/error-codes/api-errors');
      }
      if (system.includes('CEO Consolidator')) {
        return mockCompletion('CEO directive from available reports.');
      }
      return mockCompletion('Advisor recommendation.');
    });

    const result = await runAiCouncilPipeline('Should I buy a MacBook?', { mode: 'cheap' });

    const entrepreneur = result.individualAdvice.find((entry) => entry.role === 'empreendedor');
    expect(entrepreneur?.advice).toBe('Advisor unavailable right now. Continue with the available council reports.');
    expect(entrepreneur?.advice).not.toContain('429');
    expect(entrepreneur?.advice).not.toContain('platform.openai.com');
    errorSpy.mockRestore();
  });
});
