import { acquireAiUsageGuard, guardPolicyForWorkload, releaseAiUsageGuard, resolveAiGuardWorkload } from '@/lib/billing/ai-guardrails';

describe('AI fair-use guardrails', () => {
  it('uses stricter configurable policies for expensive workloads', () => {
    expect(guardPolicyForWorkload('image_generation')).toEqual(expect.objectContaining({ expensive: true }));
    expect(guardPolicyForWorkload('balys_text')).toEqual(expect.objectContaining({ expensive: false }));
  });

  it('classifies expensive Balys routes before provider execution', () => {
    expect(resolveAiGuardWorkload({ action: 'image', needsTools: true })).toBe('image_generation');
    expect(resolveAiGuardWorkload({ taskType: 'council', needsTools: true })).toBe('council');
    expect(resolveAiGuardWorkload({ toolDomain: 'web', needsTools: true })).toBe('web_grounded');
  });

  it('acquires and releases an expensive-workload lease', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: { allowed: true, lease_id: 'lease-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const admin = { rpc } as any;
    const result = await acquireAiUsageGuard(admin, 'user-1', 'image_generation');
    expect(result).toEqual({ allowed: true, leaseId: 'lease-1' });
    await releaseAiUsageGuard(admin, result.leaseId);
    expect(rpc).toHaveBeenLastCalledWith('release_ai_usage_guard', { p_lease_id: 'lease-1' });
  });

  it('returns a retryable decision when a limit is reached', async () => {
    const admin = { rpc: jest.fn().mockResolvedValue({
      data: { allowed: false, reason: 'concurrency', retry_after_seconds: 15 }, error: null,
    }) } as any;
    await expect(acquireAiUsageGuard(admin, 'user-1', 'web_grounded')).resolves.toEqual({
      allowed: false, reason: 'concurrency', retryAfterSeconds: 15, leaseId: null,
    });
  });
});
