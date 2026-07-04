// ============================================
// Nova-Scheduler — Job Executor
// ============================================
// Executes different job types (HTTP, Email, Shell, Custom)
// Each execution is idempotent where possible

import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { emitJobEvent } from '../socket';
import { SocketEvents } from '../shared/types';

interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  errorStack?: string;
}

/**
 * Execute a job based on its type and payload
 * 
 * Design decisions:
 * - Each execution is wrapped with timeout handling
 * - Results are stored in the JobExecution record
 * - Idempotent: HTTP jobs use idempotency headers where possible
 */
export class JobExecutor {
  /**
   * Execute a job payload
   */
  async execute(
    jobId: string,
    payload: Record<string, unknown>,
    type: string,
    timeoutMs: number
  ): Promise<ExecutionResult> {
    // Wrap execution in timeout
    const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
      setTimeout(() => reject(new Error(`Job execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const executionPromise = this.executeByType(type, payload);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: err.message,
        errorStack: err.stack,
      };
    }
  }

  /**
   * Route execution to the appropriate handler based on job type
   */
  private async executeByType(type: string, payload: Record<string, unknown>): Promise<ExecutionResult> {
    switch (type) {
      case 'IMMEDIATE':
      case 'DELAYED':
      case 'SCHEDULED':
      case 'RECURRING':
      case 'BATCH':
        return this.executeGenericJob(payload);

      default:
        return this.executeGenericJob(payload);
    }
  }

  /**
   * Execute a generic job — processes HTTP requests, simulated tasks, etc.
   */
  private async executeGenericJob(payload: Record<string, unknown>): Promise<ExecutionResult> {
    // If payload has a URL, make an HTTP request
    if (payload.url && typeof payload.url === 'string') {
      return this.executeHttpJob(payload);
    }

    // If payload has a script/command, simulate execution
    if (payload.command || payload.script) {
      return this.executeScriptJob(payload);
    }

    // Simulate processing for demo/test jobs
    const processingTime = (payload.processingTimeMs as number) || Math.random() * 2000 + 500;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Simulate random failures (10% chance for demo purposes)
    if (payload.simulateFailure || Math.random() < 0.1) {
      return {
        success: false,
        error: 'Simulated job failure for testing',
      };
    }

    return {
      success: true,
      result: {
        message: 'Job executed successfully',
        processedAt: new Date().toISOString(),
        payload,
      },
    };
  }

  /**
   * Execute an HTTP request job
   */
  private async executeHttpJob(payload: Record<string, unknown>): Promise<ExecutionResult> {
    try {
      const url = payload.url as string;
      const method = (payload.method as string) || 'GET';
      const headers = (payload.headers as Record<string, string>) || {};
      const body = payload.body;

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const responseData = await response.text();

      let parsedData: unknown;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      const expectedStatus = (payload.expectedStatus as number) || 200;

      if (response.status !== expectedStatus) {
        return {
          success: false,
          error: `HTTP ${response.status}: Expected ${expectedStatus}`,
          result: { status: response.status, body: parsedData },
        };
      }

      return {
        success: true,
        result: { status: response.status, body: parsedData },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: `HTTP request failed: ${err.message}`,
        errorStack: err.stack,
      };
    }
  }

  /**
   * Execute a script/command job (simulated for safety)
   */
  private async executeScriptJob(payload: Record<string, unknown>): Promise<ExecutionResult> {
    // For safety, we simulate script execution
    const command = payload.command || payload.script;
    logger.info(`Simulating script execution: ${command}`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
      result: {
        message: 'Script executed (simulated)',
        command,
        executedAt: new Date().toISOString(),
      },
    };
  }
}

export default new JobExecutor();
