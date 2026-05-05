import { estimateTokensFromText, computeCostUsd, usdToBrl } from '@/lib/ai/billing';

describe('estimateTokensFromText', () => {
  it('returns at least 1 for empty string', () => {
    expect(estimateTokensFromText('')).toBe(1);
  });

  it('estimates ~1 token per 4 chars', () => {
    // 40 chars → ceil(40/4) = 10
    expect(estimateTokensFromText('a'.repeat(40))).toBe(10);
  });

  it('handles null-ish input gracefully', () => {
    expect(estimateTokensFromText(undefined as any)).toBe(1);
  });

  it('rounds up fractional tokens', () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokensFromText('hello')).toBe(2);
  });
});

describe('computeCostUsd', () => {
  it('computes gpt-4o cost correctly', () => {
    // 1M prompt tokens at $5 + 1M completion at $15 = $20
    const cost = computeCostUsd({ provider: 'openai', model: 'gpt-4o', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    expect(cost).toBe(20);
  });

  it('computes gpt-4o-mini cost correctly', () => {
    // 100k prompt at $0.15/M + 100k completion at $0.6/M = 0.015 + 0.06 = 0.075
    const cost = computeCostUsd({ provider: 'openai', model: 'gpt-4o-mini', promptTokens: 100_000, completionTokens: 100_000 });
    expect(cost).toBeCloseTo(0.075, 5);
  });

  it('computes gemini-2.5-flash cost correctly', () => {
    // 1M prompt at $0.3 + 1M completion at $1.2 = 1.5
    const cost = computeCostUsd({ provider: 'gemini', model: 'gemini-2.5-flash', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    expect(cost).toBe(1.5);
  });

  it('falls back to default price for unknown model', () => {
    // Default: input $0.5/M, output $1.5/M → 1M+1M = 2.0
    const cost = computeCostUsd({ provider: 'openai', model: 'unknown-model-xyz', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    expect(cost).toBe(2.0);
  });

  it('returns 0 for zero tokens', () => {
    const cost = computeCostUsd({ provider: 'openai', model: 'gpt-4o', promptTokens: 0, completionTokens: 0 });
    expect(cost).toBe(0);
  });

  it('returns a number with at most 6 decimal places', () => {
    const cost = computeCostUsd({ provider: 'openai', model: 'gpt-4o-mini', promptTokens: 1234, completionTokens: 567 });
    const decimals = cost.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(6);
  });
});

describe('usdToBrl', () => {
  it('converts using default rate of 5', () => {
    expect(usdToBrl(1)).toBe(5.0);
    expect(usdToBrl(2.5)).toBe(12.5);
  });

  it('uses a custom rate when provided', () => {
    expect(usdToBrl(1, 6)).toBe(6.0);
  });

  it('returns 0 for 0 USD', () => {
    expect(usdToBrl(0)).toBe(0);
  });
});
