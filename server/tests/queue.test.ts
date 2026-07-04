// ============================================
// Nova-Scheduler — Queue Logic Unit Tests
// ============================================

import { calculateRetryDelay, shouldRetry, DEFAULT_RETRY_POLICY } from '../src/engine/retryStrategy';
import { CircuitBreaker, CircuitState } from '../src/engine/circuitBreaker';
import { RetryStrategyType } from '../src/shared/types';

describe('Retry Strategy', () => {
  describe('calculateRetryDelay', () => {
    it('should return fixed delay for FIXED strategy', () => {
      const delay = calculateRetryDelay({
        type: RetryStrategyType.FIXED,
        maxAttempts: 3,
        baseDelayMs: 5000,
        maxDelayMs: 300000,
        backoffMultiplier: 1,
      }, 1);

      // Fixed delay with ±15% jitter
      expect(delay).toBeGreaterThan(4000);
      expect(delay).toBeLessThan(6000);
    });

    it('should return linearly increasing delay for LINEAR strategy', () => {
      const policy = {
        type: RetryStrategyType.LINEAR,
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 1,
      };

      const delay1 = calculateRetryDelay(policy, 1);
      const delay2 = calculateRetryDelay(policy, 2);
      const delay3 = calculateRetryDelay(policy, 3);

      // Approximate linear increase (with jitter)
      expect(delay2).toBeGreaterThan(delay1 * 0.8);
      expect(delay3).toBeGreaterThan(delay2 * 0.8);
    });

    it('should return exponentially increasing delay for EXPONENTIAL strategy', () => {
      const policy = {
        type: RetryStrategyType.EXPONENTIAL,
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
      };

      const delay1 = calculateRetryDelay(policy, 1); // ~1000ms
      const delay2 = calculateRetryDelay(policy, 2); // ~2000ms
      const delay3 = calculateRetryDelay(policy, 3); // ~4000ms

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap delay at maxDelayMs', () => {
      const delay = calculateRetryDelay({
        type: RetryStrategyType.EXPONENTIAL,
        maxAttempts: 10,
        baseDelayMs: 10000,
        maxDelayMs: 30000,
        backoffMultiplier: 3,
      }, 10);

      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when retry count is below max', () => {
      expect(shouldRetry(0, 3)).toBe(true);
      expect(shouldRetry(1, 3)).toBe(true);
      expect(shouldRetry(2, 3)).toBe(true);
    });

    it('should return false when retry count equals max', () => {
      expect(shouldRetry(3, 3)).toBe(false);
    });

    it('should return false when retry count exceeds max', () => {
      expect(shouldRetry(5, 3)).toBe(false);
    });
  });
});

describe('Circuit Breaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker('test');
    expect(cb.getState().state).toBe(CircuitState.CLOSED);
  });

  it('should transition to OPEN after threshold failures', async () => {
    const cb = new CircuitBreaker('test-open', 3, 1000, 2);

    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    expect(cb.getState().state).toBe(CircuitState.OPEN);
  });

  it('should block requests in OPEN state', async () => {
    const cb = new CircuitBreaker('test-block', 2, 60000, 2);

    // Trigger failures
    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }

    // Should be blocked
    await expect(
      cb.execute(async () => 'success')
    ).rejects.toThrow('Circuit breaker');
  });

  it('should allow requests after reset', () => {
    const cb = new CircuitBreaker('test-reset', 2, 1000, 2);
    cb.reset();
    expect(cb.getState().state).toBe(CircuitState.CLOSED);
  });

  it('should successfully execute when CLOSED', async () => {
    const cb = new CircuitBreaker('test-success');
    const result = await cb.execute(async () => 'hello');
    expect(result).toBe('hello');
  });
});
