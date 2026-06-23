import { answerSupportQuestion, findSupportKnowledge, SUPPORT_KNOWLEDGE_BASE } from '@/lib/support/knowledge-base';

describe('support knowledge base', () => {
  it('covers the core product and billing subjects', () => {
    const keys = new Set(SUPPORT_KNOWLEDGE_BASE.map(section => section.key));
    expect([...keys]).toEqual(expect.arrayContaining([
      'getting_started', 'plans', 'credits', 'billing', 'apple_billing', 'google_billing',
      'notes_balys', 'calendar_today', 'goals', 'finance', 'reviews', 'council', 'connectors',
      'whatsapp_reminders', 'briefings', 'meetings_images', 'privacy', 'troubleshooting',
    ]));
  });

  it('finds accent-insensitive answers and limits results', () => {
    const matches = findSupportKnowledge('Como funcionam meus CREDITOS de ia?', 1);
    expect(matches).toHaveLength(1);
    expect(matches[0].key).toBe('credits');
  });

  it('adds human-readable billing context without exposing provider identifiers', () => {
    const answer = answerSupportQuestion('problema de pagamento', { plan: 'pro', provider: 'apple', state: 'active' });
    expect(answer).toContain('plano PRO');
    expect(answer).toContain('App Store');
    expect(answer).not.toContain('transaction');
  });

  it('offers escalation instead of inventing an unknown answer', () => {
    expect(answerSupportQuestion('xyz assunto desconhecido')).toContain('revisão humana');
  });

  it('answers English questions in English', () => {
    const answer = answerSupportQuestion('How do AI credits work?', { plan: 'free', provider: null, state: 'free' }, 'en-US');
    expect(answer).toContain('AI credits describe usage');
    expect(answer).toContain('Your account is on FREE');
  });
});
