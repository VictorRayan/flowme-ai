import { decodeGmailMessage } from '@/lib/google/google-gmail';

function b64url(value: string): string {
  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('decodeGmailMessage', () => {
  it('decodes single-part plain text bodies', () => {
    const message = decodeGmailMessage({
      id: 'm1',
      threadId: 't1',
      snippet: 'Snippet',
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'Subject', value: 'Hello' },
          { name: 'From', value: 'ana@example.com' },
          { name: 'To', value: 'victor@example.com' },
          { name: 'Date', value: 'Mon, 18 May 2026 10:00:00 -0300' },
        ],
        body: { data: b64url('Plain body') },
      },
    });

    expect(message.body_text).toBe('Plain body');
    expect(message.subject).toBe('Hello');
    expect(message.from).toBe('ana@example.com');
  });

  it('decodes multipart plain text and attachment metadata', () => {
    const message = decodeGmailMessage({
      id: 'm2',
      threadId: 't2',
      payload: {
        mimeType: 'multipart/mixed',
        headers: [{ name: 'Subject', value: 'Report' }],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: b64url('First part') },
          },
          {
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            body: { attachmentId: 'att-1', size: 1024 },
          },
        ],
      },
    });

    expect(message.body_text).toBe('First part');
    expect(message.attachments).toEqual([
      { filename: 'report.pdf', mimeType: 'application/pdf', size: 1024, attachmentId: 'att-1' },
    ]);
  });

  it('falls back from HTML to readable text', () => {
    const message = decodeGmailMessage({
      id: 'm3',
      threadId: 't3',
      payload: {
        mimeType: 'text/html',
        headers: [{ name: 'Subject', value: 'HTML' }],
        body: { data: b64url('<style>.x{}</style><p>Hello&nbsp;<strong>Victor</strong></p><script>alert(1)</script>') },
      },
    });

    expect(message.body_text).toBe('Hello Victor');
    expect(message.body_html).toBe('<p>Hello&nbsp;<strong>Victor</strong></p>');
  });
});
