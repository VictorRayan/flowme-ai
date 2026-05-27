import { enforceSchedulingConfirmation, parseAssistantPayload } from '@/app/api/v1/onboarding/assistant/route';

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

  it('parses JSON that has unescaped line breaks inside a string value', () => {
    const raw = '{\n  "response": "Perfeito, 1 hora por dia é ótimo!\n\nEm que horário você prefere?",\n  "type": "clarification"\n}';
    expect(parseAssistantPayload(raw)).toEqual({
      response: 'Perfeito, 1 hora por dia é ótimo!\n\nEm que horário você prefere?',
      type: 'clarification',
    });
  });

  it('never leaks a raw JSON blob into the response field', () => {
    const raw = '{\n  "response": "Que maravilha! Vamos começar.",\n  "type": "proposal"\n}';
    const result = parseAssistantPayload(raw);
    expect(result.response).toBe('Que maravilha! Vamos começar.');
    expect(result.response).not.toContain('"type"');
    expect(result.type).toBe('proposal');
  });

  it('returns null for empty input', () => {
    expect(parseAssistantPayload('')).toBeNull();
    expect(parseAssistantPayload('   ')).toBeNull();
  });
});

describe('enforceSchedulingConfirmation', () => {
  it('turns a proposal without a confirmed time into a clarification', () => {
    const result = enforceSchedulingConfirmation({
      response: 'Fechamos.',
      type: 'proposal',
      proposalData: {
        annual_smart_goal: 'Perder 8kg até dezembro',
        monthly_milestone: 'Perder 1kg no mês',
        weekly_routine: 'Caminhar todos os dias',
      },
    }, 'pt', [{ role: 'user', content: 'quero caminhar todo dia' }]);

    expect(result.type).toBe('clarification');
    expect(result.response).toContain('horário exato');
  });

  it('keeps a proposal when the routine includes an exact schedule', () => {
    const result = enforceSchedulingConfirmation({
      response: 'Fechamos.',
      type: 'proposal',
      proposalData: {
        annual_smart_goal: 'Aprender inglês até dezembro',
        monthly_milestone: 'Concluir unidade 1',
        weekly_routine: 'Estudar inglês às 21:00 por 60 minutos todos os dias',
      },
    }, 'pt', [{ role: 'user', content: 'às 21h' }]);

    expect(result.type).toBe('proposal');
  });

  it('allows proposals without time only when the user explicitly schedules later', () => {
    const result = enforceSchedulingConfirmation({
      response: 'Fechamos.',
      type: 'proposal',
      proposalData: {
        annual_smart_goal: 'Ler 12 livros até dezembro',
        monthly_milestone: 'Ler o primeiro livro',
        weekly_routine: 'Ler diariamente',
      },
    }, 'pt', [{ role: 'user', content: 'vamos marcar os horários depois' }]);

    expect(result.type).toBe('proposal');
  });
});
