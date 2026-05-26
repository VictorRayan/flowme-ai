describe('web grounded search tool', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@google/generative-ai');
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it('uses the current Gemini googleSearch tool for grounding', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => 'Resumo atual.',
        candidates: [{ groundingMetadata: { groundingChunks: [] } }],
      },
    });
    const mockGetGenerativeModel = jest.fn().mockReturnValue({ generateContent: mockGenerateContent });
    const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    }));

    jest.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: MockGoogleGenerativeAI,
    }));
    process.env.GEMINI_API_KEY = 'test-key';

    const { webGroundedSearchTool } = await import('@/lib/ai/tools/web-tools');
    const result = await webGroundedSearchTool.call({ query: 'notícias recentes sobre ia' }, {} as any);

    expect(result.ok).toBe(true);
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} }],
    }));
    expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(expect.objectContaining({
      tools: [{ googleSearchRetrieval: {} }],
    }));
  });
});
