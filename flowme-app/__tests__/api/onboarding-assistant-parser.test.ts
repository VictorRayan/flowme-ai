import { parseAssistantPayload } from '@/app/api/v1/onboarding/assistant/route';

describe('parseAssistantPayload', () => {
  it('parses clean JSON', () => {
    const raw = '{"response":"olá","type":"clarification"}';
    expect(parseAssistantPayload(raw)).toEqual({ response: 'olá', type: 'clarification' });
  });

  it('strips markdown fences before parsing', () => {
    const raw = '```json\n{"response":"oi","type":"clarification"}\n```';
    expect(parseAssistantPayload(raw)).toEqual({ response: 'oi', type: 'clarification' });
  });

  it('salvages a JSON object embedded in prose', () => {
    const raw = 'Sure! Here is the response: {"response":"oi","type":"proposal"} thanks';
    expect(parseAssistantPayload(raw)).toEqual({ response: 'oi', type: 'proposal' });
  });

  it('falls back to treating raw prose as a clarification response', () => {
    const raw = 'É ótimo saber disso! Você pode me contar mais?';
    expect(parseAssistantPayload(raw)).toEqual({
      response: 'É ótimo saber disso! Você pode me contar mais?',
      type: 'clarification',
    });
  });

  it('returns null for empty input', () => {
    expect(parseAssistantPayload('')).toBeNull();
    expect(parseAssistantPayload('   ')).toBeNull();
  });
});
