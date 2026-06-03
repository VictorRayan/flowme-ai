import {
  buildCouncilSituation,
  buildWeeklyReviewEvidence,
  filterGoalsForWeeklyReview,
  generateWeeklyReviewContent,
  getWeeklyReviewPeriod,
  hasCurrentWeeklyReviewEvidence,
  shouldRefreshWeeklyReview,
} from '@/lib/reviews/weekly-review';

describe('weekly review evidence', () => {
  it('aggregates execution, reasons, reschedules and qualitative context', () => {
    const evidence = buildWeeklyReviewEvidence({
      period: { start: '2026-05-25', end: '2026-05-31' },
      notes: [
        { title: 'Daily briefing', note_type: 'daily_briefing', note_date: '2026-05-30', content_text: 'Tive muitos imprevistos.' },
      ],
      commitments: [
        { title: 'Treino', start_at: '2026-05-30T10:00:00Z', end_at: '2026-05-30T11:00:00Z', outcome: 'completed', outcome_reason: null, reason_code: null },
        { title: 'Prospecção', start_at: '2026-05-30T12:00:00Z', end_at: '2026-05-30T13:00:00Z', outcome: 'not_done', outcome_reason: 'Reunião urgente', reason_code: 'unexpected' },
        { title: 'Leitura', start_at: '2026-05-30T14:00:00Z', end_at: '2026-05-30T15:00:00Z', outcome: 'incomplete', outcome_reason: null, reason_code: null },
      ],
      reschedules: [
        { title: 'Prospecção', movement_type: 'postponed', offset_minutes: 120, minutes_before_previous_start: 30 },
      ],
      goals: [{ title: 'Aumentar receita', status: 'in_progress' }],
      actionPlanTasks: [{ title: 'Prospecção', outcome: 'not_done' }],
      threadSummaries: [{ summary: 'Usuário relatou dificuldade para proteger blocos de foco.', key_topics: ['foco'] }],
      meetings: [{ title: '1:1', subject: 'Planejamento', objective: 'Priorizar semana' }],
      financial: null,
      weeklyBriefing: null,
    });

    expect(evidence.metrics).toEqual(expect.objectContaining({
      commitment_count: 3,
      completed_count: 1,
      not_done_count: 1,
      unanswered_count: 1,
      postponed_count: 1,
      late_postponement_count: 1,
    }));
    expect(evidence.not_done_reasons).toEqual([{ reason: 'unexpected', count: 1 }]);
    expect(evidence.has_narrative_context).toBe(true);
  });

  it('calculates a seven-day local review period', () => {
    expect(getWeeklyReviewPeriod(new Date('2026-06-01T01:00:00Z'), 'America/Sao_Paulo')).toEqual({
      start: '2026-05-25',
      end: '2026-05-31',
    });
  });

  it('excludes goals that start after the reviewed week or contain conflicting legacy years', () => {
    expect(filterGoalsForWeeklyReview([
      { title: 'Obter CNH até outubro de 2024', status: 'in_progress', starts_on: '2026-05-27', due_on: '2026-12-31', target_date: '2026-12-31T23:59:59Z' },
      { title: 'Treinar musculação', status: 'in_progress', starts_on: '2026-05-27', due_on: '2026-06-03', target_date: '2026-06-03T23:59:59Z' },
      { title: 'Estudar arquitetura', status: 'in_progress', starts_on: '2026-06-01', due_on: '2026-12-31', target_date: '2026-12-31T23:59:59Z' },
    ], { start: '2026-05-25', end: '2026-05-31' })).toEqual([
      expect.objectContaining({ title: 'Treinar musculação' }),
    ]);
  });

  it('tells the council that stored meeting recordings already have consent', () => {
    const evidence = buildWeeklyReviewEvidence({
      period: { start: '2026-05-25', end: '2026-05-31' },
      notes: [],
      commitments: [],
      reschedules: [],
      goals: [],
      actionPlanTasks: [],
      threadSummaries: [],
      meetings: [{ title: '1:1', subject: 'Teste', objective: 'Validar áudio' }],
      financial: {
        currency: 'BRL',
        period_income: 0,
        period_expenses: 120,
        period_invested: 0,
        month_to_date_income: 0,
        month_to_date_expenses: 120,
        month_to_date_invested: 0,
        investment_rate_month_to_date: null,
        top_categories: [{ category: 'alimentação', amount: 120, share: 1 }],
        goal_alignment: [],
        largest_expenses: [{ label: 'almoço', amount: 120, occurred_on: '2026-05-30', category: 'alimentação' }],
        needs_review_count: 0,
        alerts: ['Renda mensal não registrada; recomendações de investimento devem ser conservadoras.'],
      },
      weeklyBriefing: 'Testei a gravação da reunião.',
    });

    expect(buildCouncilSituation(evidence)).toContain('consentimento dos participantes já foi confirmado');
    expect(buildCouncilSituation(evidence)).toContain('não levante alertas jurídicos');
    expect(buildCouncilSituation(evidence)).toContain('Finanças pessoais');
  });

  it('invalidates reviews generated before the current evidence contract', () => {
    expect(hasCurrentWeeklyReviewEvidence({ evidence_version: 3 })).toBe(true);
    expect(hasCurrentWeeklyReviewEvidence({})).toBe(false);
  });

  it('refreshes a recent persisted review generated with the old evidence contract', () => {
    expect(shouldRefreshWeeklyReview({
      period_end: '2026-05-31',
      evidence: {} as any,
    }, new Date('2026-06-01T12:00:00Z'), 'America/Sao_Paulo')).toBe(true);
    expect(shouldRefreshWeeklyReview({
      period_end: '2026-05-31',
      evidence: { evidence_version: 3 } as any,
    }, new Date('2026-06-01T12:00:00Z'), 'America/Sao_Paulo')).toBe(false);
  });
});

describe('weekly review generation', () => {
  it('requests a weekly briefing instead of inventing a diagnosis without narrative context', async () => {
    const result = await generateWeeklyReviewContent({
      period: { start: '2026-05-25', end: '2026-05-31' },
      metrics: { commitment_count: 2, completed_count: 1, not_done_count: 0, unanswered_count: 1, postponed_count: 0, advanced_count: 0, late_postponement_count: 0 },
      not_done_reasons: [],
      notes: [],
      daily_briefings: [],
      commitments: [],
      reschedules: [],
      goals: [],
      action_plan_tasks: [],
      thread_summaries: [],
      meetings: [],
      financial: null,
      weekly_briefing: null,
      has_narrative_context: false,
    });

    expect(result.status).toBe('awaiting_briefing');
    expect(result.review_content).toBeNull();
  });

  it('generates council-backed structured feedback when context exists', async () => {
    const result = await generateWeeklyReviewContent({
      period: { start: '2026-05-25', end: '2026-05-31' },
      metrics: { commitment_count: 3, completed_count: 1, not_done_count: 2, unanswered_count: 0, postponed_count: 1, advanced_count: 0, late_postponement_count: 1 },
      not_done_reasons: [{ reason: 'unexpected', count: 2 }],
      notes: [{ title: 'Resumo', note_type: 'daily_briefing', note_date: '2026-05-31', content_text: 'Muitas reuniões urgentes.' }],
      daily_briefings: [{ title: 'Resumo', note_type: 'daily_briefing', note_date: '2026-05-31', content_text: 'Muitas reuniões urgentes.' }],
      commitments: [],
      reschedules: [],
      goals: [],
      action_plan_tasks: [],
      thread_summaries: [],
      meetings: [],
      financial: null,
      weekly_briefing: null,
      has_narrative_context: true,
    }, async () => ({ directive: 'Proteja dois blocos de foco e reduza reuniões ad hoc.', mode: 'plan' }));

    expect(result.status).toBe('ready');
    expect(result.review_content).toEqual(expect.objectContaining({
      recommendation: 'Proteja dois blocos de foco e reduza reuniões ad hoc.',
      council_mode: 'plan',
    }));
    expect(result.suggested_action_plan).toEqual(expect.objectContaining({ offered: true }));
  });
});
