// ============================================
// Nova-Scheduler — Retry Strategy Engine
// ============================================
// Implements Fixed, Linear, and Exponential backoff strategies

import { RetryStrategyType } from '../shared/types';

interface RetryPolicyConfig {
  type: RetryStrategyType;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Calculate retry delay based on the configured strategy
 *
 * Strategies:
 *   FIXED:       delay = baseDelay
 *   LINEAR:      delay = baseDelay × attempt
 *   EXPONENTIAL: delay = baseDelay × (multiplier ^ (attempt - 1)) + jitter
 *
 * All strategies cap at maxDelay and add ±15% jitter
 * to prevent thundering herd problems.
 */
export function calculateRetryDelay(
  policy: RetryPolicyConfig,
  attempt: number
): number {
  let delay: number;

  switch (policy.type) {
    case RetryStrategyType.FIXED:
      delay = policy.baseDelayMs;
      break;

    case RetryStrategyType.LINEAR:
      delay = policy.baseDelayMs * attempt;
      break;

    case RetryStrategyType.EXPONENTIAL:
      delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
      break;

    default:
      delay = policy.baseDelayMs;
  }

  // Add jitter (±15%) to prevent thundering herd
  const jitter = delay * 0.15 * (2 * Math.random() - 1);
  delay = Math.max(0, delay + jitter);

  // Cap at max delay
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Check if a job should be retried based on the policy
 */
export function shouldRetry(
  retryCount: number,
  maxAttempts: number
): boolean {
  return retryCount < maxAttempts;
}

/**
 * Default retry policy when none is configured
 */
export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  type: RetryStrategyType.EXPONENTIAL,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  backoffMultiplier: 2,
};

export default { calculateRetryDelay, shouldRetry, DEFAULT_RETRY_POLICY };
