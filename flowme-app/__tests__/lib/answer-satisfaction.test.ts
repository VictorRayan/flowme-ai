import { improveBalysAnswerIfNeeded, shouldRunAnswerSatisfaction } from '@/lib/ai/answer-satisfaction';

describe('answer satisfaction agent', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the original answer when no verifier provider is configured', async () => {
    await expect(improveBalysAnswerIfNeeded({
      userGoal: 'show me today emails',
      draftAnswer: 'I found 3 important emails.',
      uiLanguage: 'en',
      connectorIntent: 'gmail',
      toolsUsed: ['gmail.search_messages'],
    })).resolves.toBe('I found 3 important emails.');
  });

  it('skips short confirmations to avoid unnecessary latency', () => {
    expect(shouldRunAnswerSatisfaction({
      userGoal: 'delete it',
      draftAnswer: 'Done.',
      uiLanguage: 'en',
    })).toBe(false);
  });

  it('skips write receipts so a verifier cannot corrupt confirmed actions', () => {
    expect(shouldRunAnswerSatisfaction({
      userGoal: 'draft a reply to Ana',
      draftAnswer: 'Preparei um rascunho para a Ana.',
      uiLanguage: 'pt',
      connectorIntent: 'gmail',
      toolsUsed: ['gmail.create_draft'],
    })).toBe(false);
  });

  it('runs for analytical connector answers', () => {
    expect(shouldRunAnswerSatisfaction({
      userGoal: 'show me today emails and what needs action',
      draftAnswer: 'I found several emails. The most important one is from Ana because it asks for a decision today.',
      uiLanguage: 'en',
      connectorIntent: 'gmail',
      toolsUsed: ['gmail.search_messages', 'gmail.read_message'],
    })).toBe(true);
  });
});
