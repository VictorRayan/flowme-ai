import { inferImplicitConnectorIntent } from '@/lib/ai/connector-intent';

describe('connector intent inference', () => {
  it('keeps Gmail context for reply follow-ups even when the email subject mentions a contract', () => {
    const intent = inferImplicitConnectorIntent('yes, atualização de contrato do nubank you should answer "i will check it out sometime"', [
      {
        role: 'user',
        selectedAction: { action: 'gmail', label: '/gmail' },
        content: "Check today's emails and tell me what needs a response or decision.",
      },
      {
        role: 'assistant',
        thinking: [
          {
            tool: 'gmail.search_messages',
            status: 'ok',
            receipt: {
              messages: [
                {
                  id: 'msg-1',
                  subject: 'Atualização do Contrato de Conta do Nubank',
                  from: 'Nubank <no-reply@nubank.com.br>',
                  snippet: 'Atualização do contrato...',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(intent?.action).toBe('gmail');
  });

  it('still routes an explicit contract file request to Drive', () => {
    const intent = inferImplicitConnectorIntent('abre o contrato no drive');

    expect(intent?.action).toBe('drive');
  });
});
