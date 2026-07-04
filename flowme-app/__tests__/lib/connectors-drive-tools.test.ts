const mockDriveFilesList = jest.fn();
const mockDriveFilesGet = jest.fn();
const mockDriveFilesExport = jest.fn();
const mockSheetsValuesGet = jest.fn();
const mockDocsDocumentsGet = jest.fn();
const mockDocsDocumentsCreate = jest.fn();
const mockDocsDocumentsBatchUpdate = jest.fn();
const mockGetValidGoogleToken = jest.fn();
const mockRunSheetsAgent = jest.fn();
const mockRunDocsAgent = jest.fn();
const mockRequireFeature = jest.fn();

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';

    constructor(feature: string) {
      super('Feature requires Flow Me Pro');
      this.name = 'FeatureLockedError';
      this.feature = feature;
    }
  }

  return {
    FeatureLockedError,
    requireFeature: (...args: unknown[]) => mockRequireFeature(...args),
  };
});

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        list: mockDriveFilesList,
        get: mockDriveFilesGet,
        export: mockDriveFilesExport,
      },
    })),
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: mockSheetsValuesGet,
        },
      },
    })),
    docs: jest.fn(() => ({
      documents: {
        get: mockDocsDocumentsGet,
        create: mockDocsDocumentsCreate,
        batchUpdate: mockDocsDocumentsBatchUpdate,
      },
    })),
  },
}));

jest.mock('@/lib/google/google-auth', () => ({
  getValidGoogleToken: (...args: unknown[]) => mockGetValidGoogleToken(...args),
}));

jest.mock('@/lib/google/google-gmail', () => ({
  searchEmails: jest.fn(),
  createDraft: jest.fn(),
}));

jest.mock('@/lib/ai/agents/sheets-agent', () => ({
  runSheetsAgent: (...args: unknown[]) => mockRunSheetsAgent(...args),
}));

jest.mock('@/lib/ai/agents/docs-agent', () => ({
  runDocsAgent: (...args: unknown[]) => mockRunDocsAgent(...args),
}));

import {
  connectorsListTool,
  connectorsCreateDocTool,
  connectorsDocsAgentTool,
  connectorsFindAndReadDocTool,
  connectorsReadDocTool,
  connectorsReadDriveFileTool,
  connectorsReadSheetTool,
  connectorsSearchDocsTool,
  connectorsSheetsAgentTool,
} from '@/lib/ai/tools/connectors-tools';

function makeContext(connector: Record<string, unknown>) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: connector, error: null }),
  };
  const supabase = { from: jest.fn().mockReturnValue(chain) };
  return {
    supabase,
    user: { id: 'user-1', email: 'victor@example.com' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-11T12:00:00.000Z',
    chain,
  } as any;
}

describe('Drive connector tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { connectors: true } });
    mockGetValidGoogleToken.mockResolvedValue({ kind: 'oauth-client' });
  });

  it('blocks Free users before querying connector data', async () => {
    const { FeatureLockedError } = jest.requireMock('@/lib/billing/entitlements');
    mockRequireFeature.mockRejectedValueOnce(new FeatureLockedError('connectors'));
    const context = makeContext({});

    const result = await connectorsListTool.call({}, context);

    expect(result).toEqual({
      ok: false,
      error: 'Connectors require Flow Me Pro.',
      data: {
        code: 'FEATURE_LOCKED',
        required_plan: 'pro',
        feature_key: 'connectors',
        checkout_available: true,
      },
    });
    expect(context.supabase.from).not.toHaveBeenCalled();
  });

  it('discovers files account-wide and refreshes credentials', async () => {
    mockDriveFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: 'file-1',
            name: 'Budget 2026',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            modifiedTime: '2026-05-10T10:00:00.000Z',
            webViewLink: 'https://drive.google.com/file-1',
          },
        ],
      },
    });

    const context = makeContext({
      id: 'conn-1',
      type: 'google_drive',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsSearchDocsTool.call({
      connector_id: 'conn-1',
      query: 'budget',
      max_results: 5,
    }, context);

    expect(result.ok).toBe(true);
    expect(mockGetValidGoogleToken).toHaveBeenCalledWith('linked-1', {
      supabase: context.supabase,
      user: context.user,
    });
    expect(mockDriveFilesList).toHaveBeenCalledWith(expect.objectContaining({
      pageSize: 5,
      q: expect.not.stringContaining('in parents'),
    }));
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("name contains 'budget'");
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("fullText contains 'budget'");
    expect(result.receipt).toMatchObject({ count: 1 });
  });

  it('lists a connector as connected only after credentials validate', async () => {
    const connector = {
      id: 'conn-sheets',
      name: 'Finance 2026',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
      created_at: '2026-05-01T00:00:00Z',
    };
    const listChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then(resolve: Function, reject: Function) {
        return Promise.resolve({ data: [connector], error: null }).then(resolve as any, reject as any);
      },
    };
    const context = {
      supabase: { from: jest.fn().mockReturnValue(listChain) },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-11T12:00:00.000Z',
    } as any;

    const result = await connectorsListTool.call({}, context);

    expect(result.ok).toBe(true);
    expect(mockGetValidGoogleToken).toHaveBeenCalledWith('linked-1', {
      supabase: context.supabase,
      user: context.user,
    });
    expect(result.receipt).toMatchObject({
      connectors: [expect.objectContaining({
        name: 'Finance 2026',
        is_connected: true,
        connection_status: 'connected',
      })],
    });
  });

  it('lists a connector as needs_reconnect when token validation fails', async () => {
    mockGetValidGoogleToken.mockRejectedValueOnce(new Error('GOOGLE_AUTH_MISSING'));
    const connector = {
      id: 'conn-sheets',
      name: 'Finance 2026',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
      created_at: '2026-05-01T00:00:00Z',
    };
    const listChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then(resolve: Function, reject: Function) {
        return Promise.resolve({ data: [connector], error: null }).then(resolve as any, reject as any);
      },
    };
    const context = {
      supabase: { from: jest.fn().mockReturnValue(listChain) },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-11T12:00:00.000Z',
    } as any;

    const result = await connectorsListTool.call({}, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({
      connectors: [expect.objectContaining({
        is_connected: false,
        connection_status: 'needs_reconnect',
      })],
    });
  });

  it('filters discovery to Google Docs for Docs connectors', async () => {
    mockDriveFilesList.mockResolvedValue({ data: { files: [] } });
    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    await connectorsSearchDocsTool.call({ connector_id: 'conn-docs', query: '', max_results: 10 }, context);

    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("mimeType = 'application/vnd.google-apps.document'");
  });

  it('filters discovery to Google Sheets for Sheets connectors', async () => {
    mockDriveFilesList.mockResolvedValue({ data: { files: [] } });
    const context = makeContext({
      id: 'conn-sheets',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    await connectorsSearchDocsTool.call({ connector_id: 'conn-sheets', query: '', max_results: 10 }, context);

    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("mimeType = 'application/vnd.google-apps.spreadsheet'");
  });

  it('marks connector as needs_reconnect when Google Drive rejects missing scopes', async () => {
    mockDriveFilesList.mockRejectedValueOnce({
      response: { status: 403, data: { error: { message: 'insufficient authentication scopes' } } },
    });
    const context = makeContext({
      id: 'conn-drive',
      type: 'google_drive',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsSearchDocsTool.call({ connector_id: 'conn-drive', query: '', max_results: 10 }, context);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('needs reconnect');
    expect(context.chain.update).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ connection_status: 'needs_reconnect' }),
    }));
  });

  it('reads the selected Google Doc file text from Drive discovery', async () => {
    mockDriveFilesGet.mockResolvedValueOnce({
      data: {
        id: 'file-1',
        name: 'Strategy memo',
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '2026-05-10T10:00:00.000Z',
        webViewLink: 'https://drive.google.com/file-1',
        parents: ['folder-1'],
      },
    });
    mockDriveFilesExport.mockResolvedValueOnce({ data: Buffer.from('Drive file content') });

    const context = makeContext({
      id: 'conn-1',
      type: 'google_drive',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsReadDriveFileTool.call({
      connector_id: 'conn-1',
      file_id: 'file-1',
      max_chars: 10,
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDriveFilesExport).toHaveBeenCalledWith(
      { fileId: 'file-1', mimeType: 'text/plain' },
      { responseType: 'arraybuffer' },
    );
    expect(result.receipt).toMatchObject({
      title: 'Strategy memo',
      content: 'Drive file',
      truncated: true,
    });
  });

  it('reads a selected Google Doc by file id', async () => {
    mockDocsDocumentsGet.mockResolvedValueOnce({
      data: {
        title: 'Selected doc',
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: 'Selected doc body\n' } }] } },
          ],
        },
      },
    });
    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsReadDocTool.call({ connector_id: 'conn-docs', file_id: 'doc-1' }, context);

    expect(result.ok).toBe(true);
    expect(mockDocsDocumentsGet).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(result.receipt).toMatchObject({ title: 'Selected doc', content: 'Selected doc body' });
  });

  it('reads a selected Google Doc by pasted URL', async () => {
    mockDocsDocumentsGet.mockResolvedValueOnce({
      data: {
        title: 'Linked doc',
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: 'Linked doc body\n' } }] } },
          ],
        },
      },
    });
    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsReadDocTool.call({
      connector_id: 'conn-docs',
      file_id: 'https://docs.google.com/document/d/doc-from-url/edit?tab=t.0#heading=h.123',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDocsDocumentsGet).toHaveBeenCalledWith({ documentId: 'doc-from-url' });
    expect(result.receipt).toMatchObject({ title: 'Linked doc', content: 'Linked doc body' });
  });

  it('finds and reads a Google Doc by exact natural title', async () => {
    mockDriveFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'doc-2', name: 'Other doc', modifiedTime: '2026-05-09T10:00:00.000Z' },
          { id: 'doc-1', name: 'Victor - Career Profile', modifiedTime: '2026-05-10T10:00:00.000Z' },
        ],
      },
    });
    mockDocsDocumentsGet.mockResolvedValueOnce({
      data: {
        title: 'Victor - Career Profile',
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: 'Career profile body\n' } }] } },
          ],
        },
      },
    });
    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsFindAndReadDocTool.call({
      connector_id: 'conn-docs',
      name_or_url: 'Victor - Career Profile',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("mimeType = 'application/vnd.google-apps.document'");
    expect(mockDocsDocumentsGet).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(result.receipt).toMatchObject({ title: 'Victor - Career Profile', matched_by: 'exact_name' });
  });

  it('finds and reads a Google Doc directly by URL', async () => {
    mockDocsDocumentsGet.mockResolvedValueOnce({
      data: {
        title: 'URL doc',
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: 'URL doc body\n' } }] } },
          ],
        },
      },
    });
    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsFindAndReadDocTool.call({
      connector_id: 'conn-docs',
      name_or_url: 'https://docs.google.com/document/d/doc-url-1/edit',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDriveFilesList).not.toHaveBeenCalled();
    expect(mockDocsDocumentsGet).toHaveBeenCalledWith({ documentId: 'doc-url-1' });
    expect(result.receipt).toMatchObject({ title: 'URL doc', matched_by: 'url' });
  });

  it('creates a new Google Doc with initial content', async () => {
    mockDocsDocumentsCreate.mockResolvedValueOnce({ data: { documentId: 'doc-new' } });
    mockDocsDocumentsBatchUpdate.mockResolvedValueOnce({ data: {} });

    const context = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsCreateDocTool.call({
      connector_id: 'conn-docs',
      title: 'Plano financeiro',
      content: 'Resumo\n\nEste documento foi criado pelo Balys.',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDocsDocumentsCreate).toHaveBeenCalledWith({ requestBody: { title: 'Plano financeiro' } });
    expect(mockDocsDocumentsBatchUpdate).toHaveBeenCalledWith({
      documentId: 'doc-new',
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: 'Resumo\n\nEste documento foi criado pelo Balys.\n',
            },
          },
        ],
      },
    });
    expect(result.receipt).toMatchObject({
      title: 'Plano financeiro',
      document_id: 'doc-new',
      status: 'created',
    });
  });

  it('reads a selected Google Sheet by file id', async () => {
    mockSheetsValuesGet.mockResolvedValueOnce({
      data: { range: 'Sheet1!A1:B2', values: [['Month', 'Spend'], ['May', '100']] },
    });
    const context = makeContext({
      id: 'conn-sheets',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsReadSheetTool.call({
      connector_id: 'conn-sheets',
      file_id: 'sheet-1',
      range: 'Sheet1!A1:B2',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockSheetsValuesGet).toHaveBeenCalledWith({ spreadsheetId: 'sheet-1', range: 'Sheet1!A1:B2' });
    expect(result.receipt).toMatchObject({ row_count: 2 });
  });

  it('resolves and reads a Google Sheet by natural title without asking for a file id', async () => {
    mockDriveFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'sheet-other', name: 'Finance 2025', mimeType: 'application/vnd.google-apps.spreadsheet' },
          { id: 'sheet-2026', name: 'Finance 2026', mimeType: 'application/vnd.google-apps.spreadsheet' },
        ],
      },
    });
    mockSheetsValuesGet.mockResolvedValueOnce({
      data: { range: 'Sheet1!A1:B2', values: [['Month', 'Spend'], ['May', '100']] },
    });
    const context = makeContext({
      id: 'conn-sheets',
      name: 'Google Sheets',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsReadSheetTool.call({
      connector_id: 'conn-sheets',
      spreadsheet_name: 'Finance 2026',
      range: 'Sheet1!A1:B2',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("mimeType = 'application/vnd.google-apps.spreadsheet'");
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("name contains 'Finance 2026'");
    expect(mockSheetsValuesGet).toHaveBeenCalledWith({ spreadsheetId: 'sheet-2026', range: 'Sheet1!A1:B2' });
    expect(result.receipt).toMatchObject({ row_count: 2, spreadsheet_title: 'Finance 2026' });
  });

  it('runs the Sheets agent against a spreadsheet resolved by natural title', async () => {
    mockDriveFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'sheet-2026', name: 'Finance 2026', mimeType: 'application/vnd.google-apps.spreadsheet' },
        ],
      },
    });
    mockRunSheetsAgent.mockResolvedValueOnce({
      ok: true,
      summary: 'analysis done',
      changes: [],
      insights: [{ title: 'Spend', evidence: 'May spend is 100' }],
    });
    const context = makeContext({
      id: 'conn-sheets',
      name: 'Google Sheets',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    const result = await connectorsSheetsAgentTool.call({
      connector_id: 'conn-sheets',
      spreadsheet_name: 'Finance 2026',
      task: 'Explain what is in Finance 2026',
      mode: 'analyze',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockRunSheetsAgent).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'sheet-2026',
      mode: 'analyze',
    }));
  });

  it('falls back to the active Sheets connector when the model passes a spreadsheet id as connector_id', async () => {
    mockDriveFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'sheet-2026', name: 'Finance 2026', mimeType: 'application/vnd.google-apps.spreadsheet' },
        ],
      },
    });
    mockRunSheetsAgent.mockResolvedValueOnce({
      ok: true,
      summary: 'analysis done',
      changes: [],
      insights: [],
    });

    const connectorChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'conn-sheets',
            name: 'Google Sheets',
            type: 'google_sheets',
            is_active: true,
            config: { linked_account_id: 'linked-1' },
          },
          error: null,
        }),
    };
    const context = {
      supabase: { from: jest.fn().mockReturnValue(connectorChain) },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-11T12:00:00.000Z',
    } as any;

    const result = await connectorsSheetsAgentTool.call({
      connector_id: 'sheet-2026',
      spreadsheet_name: 'Finance 2026',
      task: 'Tell me what is inside Finance 2026',
      mode: 'analyze',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockGetValidGoogleToken).toHaveBeenCalledWith('linked-1', {
      supabase: context.supabase,
      user: context.user,
    });
    expect(mockRunSheetsAgent).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'sheet-2026',
      linkedAccountId: 'linked-1',
    }));
  });

  it('passes selected file ids to Docs and Sheets editing agents', async () => {
    mockRunDocsAgent.mockResolvedValueOnce({ ok: true, summary: 'doc edited', changes: [{ description: 'changed' }] });
    mockRunSheetsAgent.mockResolvedValueOnce({ ok: true, summary: 'sheet edited', changes: [{ range: 'A1', description: 'changed' }] });

    const docsContext = makeContext({
      id: 'conn-docs',
      type: 'google_docs',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });
    const sheetsContext = makeContext({
      id: 'conn-sheets',
      type: 'google_sheets',
      is_active: true,
      config: { linked_account_id: 'linked-1' },
    });

    await connectorsDocsAgentTool.call({ connector_id: 'conn-docs', task: 'Update the intro in https://docs.google.com/document/d/doc-1/edit' }, docsContext);
    await connectorsSheetsAgentTool.call({ connector_id: 'conn-sheets', file_id: 'sheet-1', task: 'Add a total row', mode: 'edit' }, sheetsContext);

    expect(mockRunDocsAgent).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1' }));
    expect(mockRunSheetsAgent).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: 'sheet-1', mode: 'edit' }));
  });

  it('falls back to the active Sheets connector when connector_id is omitted/undefined', async () => {
    mockDriveFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'sheet-2026', name: 'Finance 2026', mimeType: 'application/vnd.google-apps.spreadsheet' },
        ],
      },
    });
    mockRunSheetsAgent.mockResolvedValueOnce({
      ok: true,
      summary: 'analysis done',
      changes: [],
      insights: [],
    });

    const connectorChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'conn-sheets-fallback',
          name: 'Google Sheets Fallback',
          type: 'google_sheets',
          is_active: true,
          config: { linked_account_id: 'linked-fallback' },
        },
        error: null,
      }),
    };
    const context = {
      supabase: { from: jest.fn().mockReturnValue(connectorChain) },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-11T12:00:00.000Z',
    } as any;

    const result = await connectorsSheetsAgentTool.call({
      connector_id: undefined, // Omitted
      spreadsheet_name: 'Finance 2026',
      task: 'Tell me what is inside Finance 2026',
      mode: 'analyze',
    }, context);

    expect(result.ok).toBe(true);
    expect(mockGetValidGoogleToken).toHaveBeenCalledWith('linked-fallback', {
      supabase: context.supabase,
      user: context.user,
    });
    expect(mockRunSheetsAgent).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'sheet-2026',
      linkedAccountId: 'linked-fallback',
    }));
  });
});
