import { google } from 'googleapis';
import { getValidGoogleToken, GoogleTokenAuthContext } from './google-auth';

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
};

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
