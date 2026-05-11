import { runBalysAgentLoop, type AgentLoopOptions } from './agent-loop';

export type AgentLoopTarget = Pick<AgentLoopOptions, 'provider' | 'model'>;

export type AgentLoopFailedAttempt = {
  target: AgentLoopTarget;
  error: unknown;
  nextTarget: AgentLoopTarget | null;
};

export type AgentLoopFallbackResult = {
  result: Awaited<ReturnType<typeof runBalysAgentLoop>>;
  target: AgentLoopTarget;
  failedAttempts: AgentLoopFailedAttempt[];
};

function sameTarget(a: AgentLoopTarget, b: AgentLoopTarget): boolean {
  return a.provider === b.provider && a.model === b.model;
}

function uniqueTargets(targets: AgentLoopTarget[]): AgentLoopTarget[] {
  return targets.filter((target, index) => (
    targets.findIndex((candidate) => sameTarget(candidate, target)) === index
  ));
}

export async function runBalysAgentLoopWithFallbacks(
  options: AgentLoopOptions,
  fallbacks: Array<{ target: AgentLoopTarget }> = [],
  onAttemptFailed?: (attempt: AgentLoopFailedAttempt) => void,
  shouldRetry?: (attempt: AgentLoopFailedAttempt) => boolean,
): Promise<AgentLoopFallbackResult> {
  const targets = uniqueTargets([
    { provider: options.provider, model: options.model },
    ...fallbacks.map((fallback) => fallback.target),
  ]);

  const failedAttempts: AgentLoopFailedAttempt[] = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      const result = await runBalysAgentLoop({
        ...options,
        provider: target.provider,
        model: target.model,
      });
      return { result, target, failedAttempts };
    } catch (error) {
      const attempt = {
        target,
        error,
        nextTarget: targets[index + 1] ?? null,
      };
      failedAttempts.push(attempt);
      onAttemptFailed?.(attempt);
      if (!attempt.nextTarget || shouldRetry?.(attempt) === false) {
        throw error;
      }
    }
  }

  throw failedAttempts[failedAttempts.length - 1]?.error ?? new Error('Balys agent loop failed before any model attempt.');
}
