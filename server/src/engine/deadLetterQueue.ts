// ============================================
// Nova-Scheduler — Dead Letter Queue Manager
// ============================================
// Handles permanently failed jobs that have exhausted all retries

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emitJobEvent } from '../socket';
import { SocketEvents } from '../shared/types';

export class DeadLetterQueueManager {
  /**
   * Move a permanently failed job to the Dead Letter Queue
   */
  async moveToDeadLetterQueue(
    jobId: string,
    reason: string,
    lastError: string | null
  ): Promise<void> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        queueId: true,
        payload: true,
        retryCount: true,
        name: true,
      },
    });

    if (!job) {
      logger.error(`Cannot move job ${jobId} to DLQ: job not found`);
      return;
    }

    await prisma.$transaction([
      // Create DLQ entry
      prisma.deadLetterQueue.create({
        data: {
          originalJobId: job.id,
          queueId: job.queueId,
          reason,
          lastError,
          originalPayload: job.payload as any,
          retryCount: job.retryCount,
        },
      }),
      // Update job status to FAILED
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      }),
      // Log the event
      prisma.jobLog.create({
        data: {
          jobId,
          level: 'ERROR',
          message: `Job moved to Dead Letter Queue: ${reason}`,
          metadata: { lastError } as any,
        },
      }),
    ]);

    emitJobEvent(SocketEvents.JOB_FAILED, { jobId, reason, movedToDLQ: true });
    logger.warn(`Job ${job.name} (${jobId}) moved to Dead Letter Queue: ${reason}`);
  }

  /**
   * Retry a job from the Dead Letter Queue
   */
  async retryFromDLQ(dlqEntryId: string): Promise<void> {
    const entry = await prisma.deadLetterQueue.findUnique({
      where: { id: dlqEntryId },
      include: { originalJob: true },
    });

    if (!entry) {
      throw new Error(`DLQ entry ${dlqEntryId} not found`);
    }

    await prisma.$transaction([
      // Reset job for re-execution
      prisma.job.update({
        where: { id: entry.originalJobId },
        data: {
          status: 'QUEUED',
          retryCount: 0,
          lockedBy: null,
          lockedAt: null,
          startedAt: null,
          completedAt: null,
          failedAt: null,
        },
      }),
      // Remove DLQ entry
      prisma.deadLetterQueue.delete({
        where: { id: dlqEntryId },
      }),
      // Log
      prisma.jobLog.create({
        data: {
          jobId: entry.originalJobId,
          level: 'INFO',
          message: 'Job retried from Dead Letter Queue',
        },
      }),
    ]);

    logger.info(`Job ${entry.originalJobId} retried from DLQ`);
  }

  /**
   * Purge all entries from the DLQ
   */
  async purge(queueId?: string): Promise<number> {
    const where = queueId ? { queueId } : {};
    const result = await prisma.deadLetterQueue.deleteMany({ where });
    logger.info(`Purged ${result.count} entries from Dead Letter Queue`);
    return result.count;
  }
}

export default new DeadLetterQueueManager();
