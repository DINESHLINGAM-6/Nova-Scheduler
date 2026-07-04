// ============================================
// Nova-Scheduler — Circuit Breaker
// ============================================
// Implements the circuit breaker pattern for fault tolerance
//
// States:
//   CLOSED  → Normal operation, requests pass through
//   OPEN    → Requests are blocked after too many failures
//   HALF_OPEN → A limited number of test requests are allowed

import { logger } from '../config/logger';
import {
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_RESET_MS,
  CIRCUIT_BREAKER_HALF_OPEN_MAX,
} from '../shared/constants';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;

  private readonly name: string;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMax: number;

  constructor(
    name: string,
    threshold = CIRCUIT_BREAKER_THRESHOLD,
    resetTimeoutMs = CIRCUIT_BREAKER_RESET_MS,
    halfOpenMax = CIRCUIT_BREAKER_HALF_OPEN_MAX
  ) {
    this.name = name;
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMax = halfOpenMax;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker [${this.name}] is OPEN. Requests are blocked.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if a request can be executed
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has elapsed
        if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.halfOpenAttempts < this.halfOpenMax;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMax) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
    this.failureCount = 0;
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.threshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
      this.successCount = 0;
    }

    logger.warn(`Circuit breaker [${this.name}]: ${oldState} → ${newState}`);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): { state: CircuitState; failureCount: number; lastFailure: number | null } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime,
    };
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.lastFailureTime = null;
    logger.info(`Circuit breaker [${this.name}] manually reset`);
  }
}

export default CircuitBreaker;
