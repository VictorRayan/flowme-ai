const mockCompletionsCreate = jest.fn();
const mockSheetsGet = jest.fn();
const mockSheetsValuesGet = jest.fn();
const mockSetCredentials = jest.fn();

const openAiConfigs: any[] = [];

jest.mock('openai', () => {
  return jest.fn().mockImplementation((config) => {
    openAiConfigs.push(config);
    return {
      chat: {
        completions: {
          create: mockCompletionsCreate,
        },
      },
    };
  });
});

jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => ({
      spreadsheets: {
        get: mockSheetsGet,
        values: {
          get: mockSheetsValuesGet,
        },
      },
    })),
  },
}));

jest.mock('@/lib/google/google-auth', () => ({
  getGoogleOAuthClient: jest.fn(() => ({ setCredentials: mockSetCredentials })),
}));

import { runSheetsAgent } from '@/lib/ai/agents/sheets-agent';

function makeSupabase() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry: '2026-05-21T12:00:00.000Z',
      },
      error: null,
    }),
  };
  return { from: jest.fn().mockReturnValue(chain) };
}

describe('runSheetsAgent', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    openAiConfigs.length = 0;
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'gemini-key',
      OPENAI_API_KEY: 'openai-key',
    };
    mockSheetsGet.mockResolvedValue({
      data: {
        properties: { title: 'Finance 2026' },
        sheets: [
          { properties: { title: 'Budget', gridProperties: { rowCount: 10, columnCount: 3 } } },
        ],
      },
    });
    mockSheetsValuesGet.mockResolvedValue({
      data: { values: [['Month', 'Spend'], ['May', '100']] },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back from Gemini planning to OpenAI planning', async () => {
    mockCompletionsCreate
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              plan: 'Explain the sheet.',
              insights: [{ title: 'Spend', evidence: 'May spend is 100' }],
              operations: [],
              summary: 'Finance 2026 has monthly spending data.',
            }),
          },
        }],
      });

    const result = await runSheetsAgent({
      spreadsheetId: 'sheet-1',
      linkedAccountId: 'linked-1',
      supabase: makeSupabase(),
      task: 'Explain Finance 2026',
      mode: 'analyze',
    });

    expect(result.ok).toBe(true);
    expect(mockCompletionsCreate).toHaveBeenCalledTimes(2);
    expect(mockCompletionsCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-2.5-pro' }));
    expect(mockCompletionsCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gpt-4o' }));
    expect(openAiConfigs[0]).toMatchObject({
      apiKey: 'gemini-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    expect(openAiConfigs[1]).toMatchObject({ apiKey: 'openai-key' });
    expect(result.summary).toBe('Finance 2026 has monthly spending data.');
  });

  it('returns a deterministic read summary when every LLM planner is unavailable', async () => {
    mockCompletionsCreate
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockRejectedValueOnce(new Error('429 quota exceeded'));

    const result = await runSheetsAgent({
      spreadsheetId: 'sheet-1',
      linkedAccountId: 'linked-1',
      supabase: makeSupabase(),
      task: 'Explain Finance 2026',
      mode: 'analyze',
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Finance 2026');
    expect(result.insights?.[0]?.evidence).toContain('Month | Spend');
  });
});
