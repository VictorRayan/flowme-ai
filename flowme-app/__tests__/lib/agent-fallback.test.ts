jest.mock('@/lib/ai/agent-loop', () => ({
  runBalysAgentLoop: jest.fn(),
}));

import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { runBalysAgentLoopWithFallbacks } from '@/lib/ai/agent-fallback';

const mockedRunBalysAgentLoop = runBalysAgentLoop as jest.MockedFunction<typeof runBalysAgentLoop>;

function makeOptions() {
  return {
    messages: [{ role: 'user' as const, content: 'help me decide' }],
    tools: [],
    maxSteps: 3,
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    context: {
      supabase: {},
      user: { id: 'user-1' },
      timezone: 'UTC',
      nowIso: '2026-05-11T00:00:00.000Z',
    },
    threadId: 'thread-1',
  };
}

describe('runBalysAgentLoopWithFallbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tries the next fallback model when the primary provider fails', async () => {
    const primaryError = new Error('503 status code (no body)');
    mockedRunBalysAgentLoop
      .mockRejectedValueOnce(primaryError)
      .mockResolvedValueOnce({ content: 'Recovered answer.', messages: [], steps: 1 });
    const onAttemptFailed = jest.fn();

    const result = await runBalysAgentLoopWithFallbacks(
      makeOptions(),
      [{ target: { provider: 'openai', model: 'gpt-5.4-mini' } }],
      onAttemptFailed,
    );

    expect(mockedRunBalysAgentLoop).toHaveBeenNthCalledWith(1, expect.objectContaining({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    }));
    expect(mockedRunBalysAgentLoop).toHaveBeenNthCalledWith(2, expect.objectContaining({
      provider: 'openai',
      model: 'gpt-5.4-mini',
    }));
    expect(result.target).toEqual({ provider: 'openai', model: 'gpt-5.4-mini' });
    expect(result.result.content).toBe('Recovered answer.');
    expect(onAttemptFailed).toHaveBeenCalledWith(expect.objectContaining({
      target: { provider: 'gemini', model: 'gemini-2.5-flash' },
      error: primaryError,
      nextTarget: { provider: 'openai', model: 'gpt-5.4-mini' },
    }));
  });

  it('skips duplicate fallback targets', async () => {
    mockedRunBalysAgentLoop
      .mockRejectedValueOnce(new Error('temporary provider error'))
      .mockResolvedValueOnce({ content: 'Fallback answer.', messages: [], steps: 1 });

    await runBalysAgentLoopWithFallbacks(
      makeOptions(),
      [
        { target: { provider: 'gemini', model: 'gemini-2.5-flash' } },
        { target: { provider: 'openai', model: 'gpt-5.4-mini' } },
      ],
    );

    expect(mockedRunBalysAgentLoop).toHaveBeenCalledTimes(2);
    expect(mockedRunBalysAgentLoop).toHaveBeenLastCalledWith(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-5.4-mini',
    }));
  });

  it('throws the final provider error when every target fails', async () => {
    const finalError = new Error('final rescue failed');
    mockedRunBalysAgentLoop
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockRejectedValueOnce(finalError);

    await expect(runBalysAgentLoopWithFallbacks(
      makeOptions(),
      [{ target: { provider: 'openai', model: 'gpt-5.4' } }],
    )).rejects.toThrow(finalError);
  });

  it('does not retry when the caller marks the failure as unsafe to replay', async () => {
    const primaryError = new Error('failed after a tool call');
    mockedRunBalysAgentLoop.mockRejectedValueOnce(primaryError);
    const shouldRetry = jest.fn(() => false);

    await expect(runBalysAgentLoopWithFallbacks(
      makeOptions(),
      [{ target: { provider: 'openai', model: 'gpt-5.4-mini' } }],
      undefined,
      shouldRetry,
    )).rejects.toThrow(primaryError);

    expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({
      target: { provider: 'gemini', model: 'gemini-2.5-flash' },
      nextTarget: { provider: 'openai', model: 'gpt-5.4-mini' },
    }));
    expect(mockedRunBalysAgentLoop).toHaveBeenCalledTimes(1);
  });
});
