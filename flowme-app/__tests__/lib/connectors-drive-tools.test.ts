const mockDriveFilesList = jest.fn();
const mockDriveFilesGet = jest.fn();
const mockDriveFilesExport = jest.fn();
const mockGetValidGoogleToken = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        list: mockDriveFilesList,
        get: mockDriveFilesGet,
        export: mockDriveFilesExport,
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
  runSheetsAgent: jest.fn(),
}));

jest.mock('@/lib/ai/agents/docs-agent', () => ({
  runDocsAgent: jest.fn(),
}));

import { connectorsReadDriveFileTool, connectorsSearchDocsTool } from '@/lib/ai/tools/connectors-tools';

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

  it('discovers files inside the configured Drive folder and refreshes credentials', async () => {
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
      config: { linked_account_id: 'linked-1', folder_id: 'folder-1' },
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
      q: expect.stringContaining("'folder-1' in parents"),
    }));
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("name contains 'budget'");
    expect(mockDriveFilesList.mock.calls[0][0].q).toContain("fullText contains 'budget'");
    expect(result.receipt).toMatchObject({ count: 1 });
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
      config: { linked_account_id: 'linked-1', folder_id: 'folder-1' },
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
});
