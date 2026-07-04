import { logger } from '../../config/logger';

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs = 30000, backoffMultiplier = 2, onRetry } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) {
        logger.error(`All ${maxAttempts} retry attempts exhausted`, { error: lastError.message });
        throw lastError;
      }
      const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delayMs = Math.min(exponentialDelay + jitter, maxDelayMs);
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed. Retrying in ${Math.round(delayMs)}ms`);
      if (onRetry) onRetry(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default retryWithBackoff;
