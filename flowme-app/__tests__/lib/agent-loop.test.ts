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

import { autoResolveFileArgs, runBalysAgentLoop } from '@/lib/ai/agent-loop';
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

  it('breaks out of validation-failure loops after three identical bad calls', async () => {
    mockCompletionsCreate.mockResolvedValue({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call-loop',
            type: 'function',
            function: { name: 'connectors.sheets_agent', arguments: '{}' },
          }],
        },
      }],
    });

    const result = await runBalysAgentLoop({
      messages: [{ role: 'user', content: 'analise a planilha' }],
      tools: [{
        name: 'connectors.sheets_agent',
        description: 'Sheets analyst',
        inputSchema: z.object({ task: z.string().min(5) }),
        isReadOnly: false,
        call: jest.fn(),
      }],
      maxSteps: 30,
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

    expect(result.content).toContain('reformular');
    expect(mockCompletionsCreate.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('patches file_id from a prior search_docs receipt when the model omits it', () => {
    const messages = [
      { role: 'user', content: 'o que tem na planilha do InfoMoney' },
      {
        role: 'tool',
        tool_call_id: 'prior-search',
        name: 'connectors.search_docs',
        content: JSON.stringify({
          ok: true,
          receipt: {
            files: [{ id: 'file-infomoney-id', name: 'InfoMoney - Planilha de Gastos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
            count: 1,
          },
        }),
      },
    ];

    const patched = autoResolveFileArgs('connectors.read_drive_file', {}, messages, 'o que tem na planilha do InfoMoney');
    expect(patched).toMatchObject({ file_id: 'file-infomoney-id' });
  });

  it('falls back to the only recent file when the user does not name one', () => {
    const messages = [
      {
        role: 'tool',
        tool_call_id: 'prior-search',
        name: 'connectors.search_docs',
        content: JSON.stringify({ ok: true, receipt: { files: [{ id: 'only-file-id', name: 'Some Sheet.xlsx' }] } }),
      },
    ];
    const patched = autoResolveFileArgs('connectors.sheets_agent', { task: 'show data' }, messages, 'me mostra o conteúdo');
    expect(patched).toMatchObject({ file_id: 'only-file-id', spreadsheet_name: 'Some Sheet.xlsx' });
  });

  it('respects an explicit file_id and does not overwrite it', () => {
    const messages = [
      {
        role: 'tool',
        tool_call_id: 'prior-search',
        name: 'connectors.search_docs',
        content: JSON.stringify({ ok: true, receipt: { files: [{ id: 'other-id', name: 'Another File.xlsx' }] } }),
      },
    ];
    const patched = autoResolveFileArgs('connectors.read_drive_file', { file_id: 'explicit-id' }, messages, 'qualquer texto');
    expect(patched).toEqual({ file_id: 'explicit-id' });
  });
});
