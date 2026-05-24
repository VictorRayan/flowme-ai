const mockCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCompletionsCreate,
      },
    },
  }));
});

import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { z } from 'zod';

describe('runBalysAgentLoop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'gemini-key';
  });

  it('honors connector step budgets above the old internal cap of eight', async () => {
    mockCompletionsCreate.mockImplementation(async () => ({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'missing-tool-call',
            type: 'function',
            function: { name: 'missing.tool', arguments: '{}' },
          }],
        },
      }],
    }));

    const result = await runBalysAgentLoop({
      messages: [{ role: 'user', content: 'keep working' }],
      tools: [],
      maxSteps: 12,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      context: {
        supabase: { from: jest.fn() },
        user: { id: 'user-1' },
        timezone: 'UTC',
        nowIso: '2026-05-21T00:00:00.000Z',
      } as any,
      threadId: 'thread-1',
    });

    expect(result.steps).toBe(12);
    expect(mockCompletionsCreate).toHaveBeenCalledTimes(12);
  });

  it('can force the first tool for deterministic connector turns', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({
      choices: [{
        finish_reason: 'stop',
        message: { role: 'assistant', content: 'Done.' },
      }],
    });

    await runBalysAgentLoop({
      messages: [{ role: 'user', content: '/gmail today mails' }],
      tools: [{
        name: 'gmail.search_messages',
        description: 'Search Gmail',
        inputSchema: z.object({ query: z.string().optional() }),
        isReadOnly: true,
        call: jest.fn(),
      }],
      maxSteps: 1,
      requiredFirstTool: 'gmail.search_messages',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      context: {
        supabase: { from: jest.fn() },
        user: { id: 'user-1' },
        timezone: 'UTC',
        nowIso: '2026-05-21T00:00:00.000Z',
      } as any,
      threadId: 'thread-1',
    });

    expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      tool_choice: { type: 'function', function: { name: 'gmail.search_messages' } },
    }));
  });
});
