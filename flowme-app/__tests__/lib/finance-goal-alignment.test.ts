import { buildFinancialGoalAlignment, extractFinancialGoalTarget } from '@/lib/finance/goal-alignment';

describe('financial goal alignment', () => {
  it('parses annual savings goal from natural text', () => {
    const target = extractFinancialGoalTarget({
      title: 'Poupar R$12K ao ano',
      timeframe: 'yearly',
      status: 'in_progress',
    });
    expect(target).toEqual({
      target_amount: 12000,
      target_period: 'annual',
      basis: 'parsed_goal_text',
    });
  });

  it('uses structured goal values before text parsing', () => {
    const target = extractFinancialGoalTarget({
      title: 'Guardar dinheiro',
      timeframe: 'yearly',
      status: 'in_progress',
      objective_metric: 'savings',
      target_value: 24000,
      unit: 'BRL',
    });
    expect(target).toEqual({
      target_amount: 24000,
      target_period: 'annual',
      basis: 'structured_goal',
    });
  });

  it('compares monthly target with invested plus positive balance', () => {
    const [alignment] = buildFinancialGoalAlignment([{
      title: 'Poupar R$12K ao ano',
      timeframe: 'yearly',
      status: 'in_progress',
    }], {
      currency: 'BRL',
      total_invested: 700,
      net_balance: 50,
    });
    expect(alignment.monthly_target).toBe(1000);
    expect(alignment.actual_saved).toBe(750);
    expect(alignment.gap).toBe(-250);
    expect(alignment.adherence).toBe(0.75);
    expect(alignment.status).toBe('behind');
  });
});
