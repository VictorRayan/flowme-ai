import { trendsFromTopicsTool } from '@/lib/ai/tools/trends-tools';

describe('trendsFromTopicsTool', () => {
  const originalFetch = global.fetch;
  const originalXaiKey = process.env.XAI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.XAI_API_KEY = originalXaiKey;
  });

  it('uses x_search and returns linkable X headlines', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output_text: JSON.stringify({
          trends: [{
            topic: 'ia',
            headline: 'Agentes de IA viram o centro da conversa',
            subheadline: 'Criadores e builders no X discutem automações pessoais e impactos em produto.',
            url: 'https://x.com/example/status/123',
            signals: [{ quote: 'A conversa está focada em casos práticos.', url: 'https://x.com/example/status/123' }],
          }],
        }),
      }),
    }) as any;

    const result = await trendsFromTopicsTool.call({ topics: ['ia'] }, {} as any);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://api.x.ai/v1/responses', expect.objectContaining({
      method: 'POST',
    }));
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.tools).toEqual([{ type: 'x_search' }]);
    expect(result.receipt.trends[0]).toEqual(expect.objectContaining({
      headline: 'Agentes de IA viram o centro da conversa',
      subheadline: 'Criadores e builders no X discutem automações pessoais e impactos em produto.',
      url: 'https://x.com/example/status/123',
    }));
  });

  it('does not return non-X links', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output_text: JSON.stringify({
          trends: [{
            topic: 'bitcoin',
            headline: 'Bitcoin domina debate',
            subheadline: 'Resumo vindo de uma fonte sem link do X.',
            url: 'https://example.com/bitcoin',
            signals: [],
          }],
        }),
      }),
    }) as any;

    const result = await trendsFromTopicsTool.call({ topics: ['bitcoin'] }, {} as any);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('no linkable trends');
  });
});
