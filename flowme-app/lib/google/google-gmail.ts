import { google, gmail_v1 } from 'googleapis';
import { getValidGoogleToken, GoogleTokenAuthContext } from './google-auth';

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
};

export type GmailAttachmentMeta = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
};

export type GmailMessageBody = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body_text: string;
  body_html?: string;
  attachments: GmailAttachmentMeta[];
};

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .trim();
}

function htmlToText(html: string): string {
  return sanitizeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function collectMessageParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  state: { plain: string[]; html: string[]; attachments: GmailAttachmentMeta[] },
) {
  if (!part) return;

  const filename = part.filename || '';
  if (filename) {
    state.attachments.push({
      filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body?.size || 0,
      attachmentId: part.body?.attachmentId || undefined,
    });
  }

  const data = part.body?.data;
  if (data && !filename) {
    const decoded = decodeBase64Url(data);
    if (part.mimeType === 'text/plain') state.plain.push(decoded);
    if (part.mimeType === 'text/html') state.html.push(sanitizeHtml(decoded));
  }

  for (const child of part.parts || []) {
    collectMessageParts(child, state);
  }
}

export function decodeGmailMessage(message: gmail_v1.Schema$Message): GmailMessageBody {
  const state: { plain: string[]; html: string[]; attachments: GmailAttachmentMeta[] } = { plain: [], html: [], attachments: [] };
  collectMessageParts(message.payload || undefined, state);

  const bodyText = state.plain.join('\n').trim() || state.html.map(htmlToText).join('\n').trim();
  const headers = message.payload?.headers || [];

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    snippet: message.snippet || '',
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    from: getHeader(headers, 'From') || '(Unknown Sender)',
    to: getHeader(headers, 'To'),
    date: getHeader(headers, 'Date'),
    body_text: bodyText,
    body_html: state.html.length > 0 ? state.html.join('\n') : undefined,
    attachments: state.attachments,
  };
}

export async function searchEmails(linkedAccountId: string, query: string, maxResults: number = 10, authContext?: GoogleTokenAuthContext): Promise<GmailMessageSummary[]> {
  const auth = await getValidGoogleToken(linkedAccountId, authContext);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];

  const detailedMessages = await Promise.all(
    messages.map(async (msg) => {
      if (!msg.id) return null;
      try {
        const getRes = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = getRes.data.payload?.headers || [];
        const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '(Unknown Sender)';
        const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

        return {
          id: msg.id,
          threadId: getRes.data.threadId || '',
          snippet: getRes.data.snippet || '',
          subject,
          from,
          date,
        };
      } catch (err) {
        console.error(`Failed to fetch email details for ${msg.id}:`, err);
        return null;
      }
    })
  );

  return detailedMessages.filter((m): m is GmailMessageSummary => m !== null);
}

export async function readEmailMessage(linkedAccountId: string, messageId: string, authContext?: GoogleTokenAuthContext): Promise<GmailMessageBody> {
  const auth = await getValidGoogleToken(linkedAccountId, authContext);
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return decodeGmailMessage(res.data);
}

export async function createDraft(linkedAccountId: string, to: string[], subject: string, bodyText: string, authContext?: GoogleTokenAuthContext): Promise<{ id: string; messageId: string }> {
  const auth = await getValidGoogleToken(linkedAccountId, authContext);
  const gmail = google.gmail({ version: 'v1', auth });

  // Create RFC 2822 formatted email
  const messageParts = [
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    bodyText,
  ];
  const message = messageParts.join('\n');

  // Base64Url encode the message
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  if (!res.data.id) {
    throw new Error('Failed to create draft');
  }

  return {
    id: res.data.id,
    messageId: res.data.message?.id || '',
  };
}
