type ConnectorThinkingStep = {
  tool?: string;
  status?: string;
  receipt?: any;
};

type ConnectorContextMessage = {
  role?: string;
  content?: string;
  thinking?: ConnectorThinkingStep[];
};

type ConnectorMemoryItem = {
  tool: string;
  label: string;
  data: Record<string, unknown>;
};

export type RecentConnectorType = 'gmail' | 'google_drive' | 'google_docs' | 'google_sheets';

const CONNECTOR_TOOL_PREFIXES = ['gmail.', 'connectors.'];

function isConnectorTool(tool: string): boolean {
  return CONNECTOR_TOOL_PREFIXES.some((prefix) => tool.startsWith(prefix));
}

function compactGmailMessage(message: any): Record<string, unknown> {
  return {
    id: message.id,
    threadId: message.threadId,
    subject: message.subject,
    from: message.from,
    date: message.date,
    snippet: message.snippet,
  };
}

function compactFile(file: any): Record<string, unknown> {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  };
}

function compactConnectorReceipt(tool: string, receipt: any): ConnectorMemoryItem[] {
  if (!receipt || typeof receipt !== 'object') return [];

  if (tool === 'gmail.search_messages' && Array.isArray(receipt.messages)) {
    return receipt.messages.slice(0, 10).map((message: any, index: number) => ({
      tool,
      label: `Gmail result ${index + 1}`,
      data: compactGmailMessage(message),
    }));
  }

  if (tool === 'gmail.read_message' && receipt.message) {
    const message = receipt.message;
    return [{
      tool,
      label: 'Last opened Gmail message',
      data: {
        ...compactGmailMessage(message),
        to: message.to,
        body_text_length: message.body_text_length,
        attachment_count: typeof message.attachment_count === 'number'
          ? message.attachment_count
          : Array.isArray(message.attachments) ? message.attachments.length : 0,
      },
    }];
  }

  if (tool === 'connectors.search_docs' && Array.isArray(receipt.files)) {
    return receipt.files.slice(0, 10).map((file: any, index: number) => ({
      tool,
      label: `Connector file ${index + 1}`,
      data: compactFile(file),
    }));
  }

  if (tool === 'connectors.read_sheet') {
    return [{
      tool,
      label: 'Last read spreadsheet',
      data: {
        spreadsheet_title: receipt.spreadsheet_title,
        range: receipt.range,
        row_count: receipt.row_count,
      },
    }];
  }

  if (tool === 'connectors.read_doc' || tool === 'connectors.find_and_read_doc') {
    return [{
      tool,
      label: 'Last read document',
      data: {
        document_id: receipt.document_id,
        title: receipt.title,
        matched_by: receipt.matched_by,
        word_count: receipt.word_count,
      },
    }];
  }

  if (tool === 'connectors.read_drive_file') {
    return [{
      tool,
      label: 'Last read Drive file',
      data: {
        title: receipt.title,
        mimeType: receipt.mimeType,
        webViewLink: receipt.webViewLink,
        character_count: receipt.character_count,
      },
    }];
  }

  return [];
}

export function extractConnectorContextItems(messages: ConnectorContextMessage[], limit = 20): ConnectorMemoryItem[] {
  const items: ConnectorMemoryItem[] = [];
  for (const message of messages) {
    for (const step of message.thinking || []) {
      const tool = typeof step.tool === 'string' ? step.tool : '';
      if (step.status !== 'ok' || !isConnectorTool(tool)) continue;
      items.push(...compactConnectorReceipt(tool, step.receipt));
    }
  }
  return items.slice(-limit);
}

export function renderConnectorContextForPrompt(messages: ConnectorContextMessage[]): string {
  const items = extractConnectorContextItems(messages);
  if (items.length === 0) return '';

  return [
    'Recent connector context from this thread follows. Use it only internally to resolve follow-ups like "the first email", "the Pedro Sobral one", "that sheet", or a quoted file title. Never show technical ids to the user.',
    ...items.map((item) => `- ${item.label} via ${item.tool}: ${JSON.stringify(item.data)}`),
  ].join('\n');
}

export function hasRecentConnectorContext(messages: ConnectorContextMessage[], predicate: (item: ConnectorMemoryItem) => boolean): boolean {
  return extractConnectorContextItems(messages).some(predicate);
}

export function inferRecentConnectorType(messages: ConnectorContextMessage[]): RecentConnectorType | undefined {
  const items = extractConnectorContextItems(messages);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.tool.startsWith('gmail.')) return 'gmail';
    const mimeType = typeof item.data.mimeType === 'string' ? item.data.mimeType : '';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google_sheets';
    if (mimeType === 'application/vnd.google-apps.document') return 'google_docs';
    if (item.tool === 'connectors.read_sheet' || item.data.spreadsheet_title) return 'google_sheets';
    if (item.tool === 'connectors.read_doc' || item.tool === 'connectors.find_and_read_doc' || item.data.document_id) return 'google_docs';
    if (item.tool === 'connectors.read_drive_file' || item.tool === 'connectors.search_docs') return 'google_drive';
  }
  return undefined;
}
