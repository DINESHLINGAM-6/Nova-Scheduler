// ============================================
// Nova-Scheduler — Queue Manager
// ============================================
// Manages job claiming with atomic locking to prevent duplicate execution
// Uses SELECT ... FOR UPDATE SKIP LOCKED for concurrent access

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emitJobEvent, emitToQueue } from '../socket';
import { SocketEvents, RetryStrategyType } from '../shared/types';
import { calculateRetryDelay, shouldRetry, DEFAULT_RETRY_POLICY } from './retryStrategy';
import dlqManager from './deadLetterQueue';
import executor from './executor';
import { CircuitBreaker } from './circuitBreaker';

// Circuit breaker for the queue processing
const queueCircuitBreaker = new CircuitBreaker('queue-processor');

export class QueueManager {
  private activeJobs = new Map<string, boolean>(); // Track currently running jobs

  /**
   * Poll a queue for available jobs and claim them atomically
   * 
   * Uses raw SQL with FOR UPDATE SKIP LOCKED to prevent
   * multiple workers from claiming the same job.
   * This is the atomic job claiming pattern for concurrency.
   */
  async claimNextJob(workerId: string, queueId?: string): Promise<string | null> {
    try {
      const result = await queueCircuitBreaker.execute(async () => {
        // Use raw SQL for atomic claiming with SKIP LOCKED
        // This prevents duplicate execution across multiple workers
        const queueFilter = queueId ? `AND j."queue_id" = '${queueId}'` : '';

        const jobs = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `
          UPDATE jobs 
          SET 
            status = 'CLAIMED',
            locked_by = $1,
            locked_at = NOW()
          WHERE id = (
            SELECT j.id 
            FROM jobs j
            INNER JOIN queues q ON j.queue_id = q.id
            WHERE j.status = 'QUEUED'
              AND q.is_paused = false
              AND j.locked_by IS NULL
              ${queueFilter}
              AND (j.scheduled_at IS NULL OR j.scheduled_at <= NOW())
            ORDER BY j.priority ASC, j.created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING id
          `,
          workerId
        );

        return jobs.length > 0 ? jobs[0].id : null;
      });

      if (result) {
        emitJobEvent(SocketEvents.JOB_CLAIMED, { jobId: result, workerId });
        logger.debug(`Job ${result} claimed by worker ${workerId}`);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to claim job: ${err.message}`);
      return null;
    }
  }

  /**
   * Execute a claimed job
   */
  async executeJob(jobId: string, workerId: string): Promise<void> {
    if (this.activeJobs.has(jobId)) {
      logger.warn(`Job ${jobId} is already being executed`);
      return;
    }

    this.activeJobs.set(jobId, true);

    try {
      // Fetch job details
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          queue: {
            include: { retryPolicy: true },
          },
        },
      });

      if (!job) {
        logger.error(`Job ${jobId} not found for execution`);
        return;
      }

      // Update status to RUNNING
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      emitJobEvent(SocketEvents.JOB_STARTED, { jobId, workerId });

      // Create execution record
      const execution = await prisma.jobExecution.create({
        data: {
          jobId,
          workerId,
          attempt: job.retryCount + 1,
          status: 'RUNNING',
        },
      });

      // Log execution start
      await prisma.jobLog.create({
        data: {
          jobId,
          executionId: execution.id,
          level: 'INFO',
          message: `Execution started (attempt ${job.retryCount + 1})`,
        },
      });

      const startTime = Date.now();

      // Execute the job
      const result = await executor.execute(
        jobId,
        job.payload as Record<string, unknown>,
        job.type,
        job.timeoutMs
      );

      const durationMs = Date.now() - startTime;

      if (result.success) {
        // Job succeeded
        await this.handleJobSuccess(jobId, execution.id, result.result, durationMs);
      } else {
        // Job failed — check retry policy
        await this.handleJobFailure(
          jobId,
          execution.id,
          result.error || 'Unknown error',
          result.errorStack,
          durationMs,
          job.retryCount,
          job.maxRetries,
          job.queue.retryPolicy
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Job execution error for ${jobId}: ${err.message}`);

      // Mark as failed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Handle successful job completion
   */
  private async handleJobSuccess(
    jobId: string,
    executionId: string,
    result: unknown,
    durationMs: number
  ): Promise<void> {
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      }),
      prisma.jobExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs,
          result: result as any,
        },
      }),
      prisma.jobLog.create({
        data: {
          jobId,
          executionId,
          level: 'INFO',
          message: `Job completed successfully in ${durationMs}ms`,
        },
      }),
    ]);

    emitJobEvent(SocketEvents.JOB_COMPLETED, { jobId, durationMs });
    logger.info(`Job ${jobId} completed in ${durationMs}ms`);
  }

  /**
   * Handle job failure — retry or move to DLQ
   */
  private async handleJobFailure(
    jobId: string,
    executionId: string,
    error: string,
    errorStack: string | undefined,
    durationMs: number,
    currentRetryCount: number,
    maxRetries: number,
    retryPolicy: any
  ): Promise<void> {
    // Update execution as failed
    await prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs,
        error,
        errorStack,
      },
    });

    // Check if we should retry
    const policyConfig = retryPolicy
      ? {
          type: retryPolicy.type as RetryStrategyType,
          maxAttempts: retryPolicy.maxAttempts,
          baseDelayMs: retryPolicy.baseDelayMs,
          maxDelayMs: retryPolicy.maxDelayMs,
          backoffMultiplier: retryPolicy.backoffMultiplier,
        }
      : DEFAULT_RETRY_POLICY;

    if (shouldRetry(currentRetryCount, maxRetries)) {
      // Schedule retry
      const delayMs = calculateRetryDelay(policyConfig, currentRetryCount + 1);
      const nextRunAt = new Date(Date.now() + delayMs);

      await prisma.$transaction([
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'RETRYING',
            retryCount: currentRetryCount + 1,
            scheduledAt: nextRunAt,
            lockedBy: null,
            lockedAt: null,
          },
        }),
        prisma.jobLog.create({
          data: {
            jobId,
            executionId,
            level: 'WARN',
            message: `Job failed. Retrying in ${Math.round(delayMs)}ms (attempt ${currentRetryCount + 2}/${maxRetries + 1}). Error: ${error}`,
          },
        }),
      ]);

      emitJobEvent(SocketEvents.JOB_RETRYING, {
        jobId,
        retryCount: currentRetryCount + 1,
        nextRunAt,
        delayMs,
      });

      logger.warn(`Job ${jobId} scheduled for retry in ${Math.round(delayMs)}ms`);

      // After delay, re-queue the job
      setTimeout(async () => {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'QUEUED', scheduledAt: null },
        });
      }, delayMs);
    } else {
      // Max retries exhausted — move to Dead Letter Queue
      await dlqManager.moveToDeadLetterQueue(
        jobId,
        `Exhausted all ${maxRetries} retry attempts`,
        error
      );
    }
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return queueCircuitBreaker.getState();
  }
}

export default new QueueManager();
