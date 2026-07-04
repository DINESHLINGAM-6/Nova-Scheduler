// ============================================
// Nova-Scheduler — Queue Service
// ============================================

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../middleware/errorHandler';
import { CreateQueueInput, UpdateQueueInput } from './queue.schema';
import { buildPaginationMeta } from '../../shared/utils/apiResponse';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../../shared/constants';
import { emitJobEvent } from '../../socket';
import { SocketEvents } from '../../shared/types';

export class QueueService {
  async create(input: CreateQueueInput) {
    const { retryPolicy, ...queueData } = input;

    const queue = await prisma.$transaction(async (tx) => {
      // Create retry policy if provided
      let retryPolicyId: string | undefined;
      if (retryPolicy) {
        const policy = await tx.retryPolicy.create({
          data: retryPolicy,
        });
        retryPolicyId = policy.id;
      }

      return tx.queue.create({
        data: {
          ...queueData,
          retryPolicyId,
        },
        include: {
          project: { select: { id: true, name: true } },
          retryPolicy: true,
          _count: { select: { jobs: true } },
        },
      });
    });

    logger.info(`Queue created: ${queue.name} (${queue.id})`);
    return queue;
  }

  async findAll(projectId?: string, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    const where = projectId ? { projectId } : {};
    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          retryPolicy: true,
          _count: { select: { jobs: true, deadLetterEntries: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.queue.count({ where }),
    ]);

    return { queues, meta: buildPaginationMeta(page, limit, total) };
  }

  async findById(id: string) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
        retryPolicy: true,
        _count: { select: { jobs: true, deadLetterEntries: true } },
      },
    });

    if (!queue) throw new NotFoundError('Queue');
    return queue;
  }

  async update(id: string, input: UpdateQueueInput) {
    await this.findById(id);
    const queue = await prisma.queue.update({
      where: { id },
      data: input,
      include: {
        project: { select: { id: true, name: true } },
        retryPolicy: true,
      },
    });

    // Emit pause/resume events
    if (input.isPaused !== undefined) {
      emitJobEvent(
        input.isPaused ? SocketEvents.QUEUE_PAUSED : SocketEvents.QUEUE_RESUMED,
        { queueId: id, isPaused: input.isPaused }
      );
    }

    return queue;
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.queue.delete({ where: { id } });
    logger.info(`Queue deleted: ${id}`);
  }

  /**
   * Get queue statistics — job counts by status
   */
  async getStats(id: string) {
    await this.findById(id);

    const stats = await prisma.job.groupBy({
      by: ['status'],
      where: { queueId: id },
      _count: { status: true },
    });

    const jobsByStatus: Record<string, number> = {};
    stats.forEach((s) => {
      jobsByStatus[s.status] = s._count.status;
    });

    const totalJobs = Object.values(jobsByStatus).reduce((a, b) => a + b, 0);
    const completedJobs = jobsByStatus['COMPLETED'] || 0;
    const failedJobs = jobsByStatus['FAILED'] || 0;

    // Average execution time for completed jobs
    const avgExecTime = await prisma.jobExecution.aggregate({
      where: {
        job: { queueId: id },
        status: 'COMPLETED',
        durationMs: { not: null },
      },
      _avg: { durationMs: true },
    });

    const dlqCount = await prisma.deadLetterQueue.count({
      where: { queueId: id },
    });

    return {
      totalJobs,
      jobsByStatus,
      completedJobs,
      failedJobs,
      successRate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(2) : '0',
      avgExecutionTimeMs: Math.round(avgExecTime._avg.durationMs || 0),
      deadLetterCount: dlqCount,
    };
  }

  /**
   * Pause a queue — stops processing new jobs
   */
  async pause(id: string) {
    return this.update(id, { isPaused: true });
  }

  /**
   * Resume a paused queue
   */
  async resume(id: string) {
    return this.update(id, { isPaused: false });
  }
}

export default new QueueService();
