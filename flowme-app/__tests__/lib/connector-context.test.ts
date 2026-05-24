import { extractConnectorContextItems, renderConnectorContextForPrompt } from '@/lib/ai/connector-context';

describe('connector context helpers', () => {
  it('extracts Gmail search receipts for follow-up resolution', () => {
    const messages = [{
      role: 'assistant',
      content: 'Here are emails from today',
      thinking: [{
        tool: 'gmail.search_messages',
        status: 'ok',
        receipt: {
          messages: [{
            id: 'msg-1',
            threadId: 'thread-1',
            subject: 'AULA 3 COMEÇOU',
            from: 'Pedro Sobral <pedro@example.com>',
            date: 'today',
            snippet: 'Aula 3 started',
          }],
          count: 1,
        },
      }],
    }];

    const items = extractConnectorContextItems(messages);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tool: 'gmail.search_messages',
      label: 'Gmail result 1',
      data: {
        id: 'msg-1',
        subject: 'AULA 3 COMEÇOU',
        from: 'Pedro Sobral <pedro@example.com>',
      },
    });
  });

  it('renders hidden connector context without raw email body text', () => {
    const prompt = renderConnectorContextForPrompt([{
      role: 'assistant',
      content: 'I read it',
      thinking: [{
        tool: 'gmail.read_message',
        status: 'ok',
        receipt: {
          message: {
            id: 'msg-1',
            subject: 'Your free trial ends today',
            from: 'Tom from LOVO',
            date: 'today',
            body_text_length: 1200,
          },
        },
      }],
    }]);

    expect(prompt).toContain('Recent connector context');
    expect(prompt).toContain('Your free trial ends today');
    expect(prompt).toContain('body_text_length');
    expect(prompt).not.toContain('Full body');
  });
});
