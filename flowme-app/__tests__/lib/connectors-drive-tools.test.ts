const mockDriveFilesList = jest.fn();
const mockDriveFilesGet = jest.fn();
const mockDriveFilesExport = jest.fn();
const mockSheetsValuesGet = jest.fn();
const mockDocsDocumentsGet = jest.fn();
const mockGetValidGoogleToken = jest.fn();
const mockRunSheetsAgent = jest.fn();
const mockRunDocsAgent = jest.fn();

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
  connectorsDocsAgentTool,
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
    maybeSingle: jest.fn().mockResolvedValue({ data: connector, error: null }),
  };
  const supabase = { from: jest.fn().mockReturnValue(chain) };
  return {
    supabase,
    user: { id: 'user-1', email: 'victor@example.com' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-11T12:00:00.000Z',
  } as any;
}

describe('Drive connector tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValidGoogleToken.mockResolvedValue({ kind: 'oauth-client' });
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

    await connectorsDocsAgentTool.call({ connector_id: 'conn-docs', file_id: 'doc-1', task: 'Update the intro' }, docsContext);
    await connectorsSheetsAgentTool.call({ connector_id: 'conn-sheets', file_id: 'sheet-1', task: 'Add a total row' }, sheetsContext);

    expect(mockRunDocsAgent).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1' }));
    expect(mockRunSheetsAgent).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: 'sheet-1' }));
  });
});
