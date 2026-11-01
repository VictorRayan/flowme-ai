import { z } from 'zod';
import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import type { Tool } from '@/lib/ai/tools/Tool';

const mockCompletion = jest.fn();
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCompletion } },
})));

function modelToolCall() {
  return {
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'call-1', type: 'function', function: {
          name: 'notes.create_note', arguments: JSON.stringify({ title: 'Injected' }),
        } }],
      },
    }],
  };
}

const tool = {
  name: 'notes.create_note', description: 'Create a note', isReadOnly: false,
  inputSchema: z.object({ title: z.string() }),
  call: jest.fn().mockResolvedValue({ ok: true, receipt: { title: 'Injected' } }),
} as Tool;

function options(tools: Tool[], userText: string) {
  return {
    messages: [{ role: 'user' as const, content: userText }],
    tools, maxSteps: 2, provider: 'openai', model: 'test-model', threadId: 'test-thread',
    context: {
      user: { id: 'user-a' }, timezone: 'UTC', nowIso: '2026-10-31T12:00:00Z',
      supabase: { from: jest.fn() },
    },
  };
}

describe('Balys tool execution boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompletion.mockResolvedValueOnce(modelToolCall()).mockResolvedValueOnce({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Done' } }],
    });
  });

  it('rejects a tool call absent from the allowed tool list', async () => {
    const result = await runBalysAgentLoop(options([], 'Create a note'));
    expect(tool.call).not.toHaveBeenCalled();
    expect(result.messages.some(message => message.role === 'tool' && String(message.content).includes('not allowed'))).toBe(true);
  });

  it('rejects an allowed write tool when the signed-in user asked only to read', async () => {
    const result = await runBalysAgentLoop(options([tool], 'Summarize this document'));
    expect(tool.call).not.toHaveBeenCalled();
    expect(result.messages.some(message => message.role === 'tool' && String(message.content).includes('requires a request'))).toBe(true);
  });
});
