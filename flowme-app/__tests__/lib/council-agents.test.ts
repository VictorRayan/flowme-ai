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

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
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
});
