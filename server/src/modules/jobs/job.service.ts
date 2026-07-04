// ============================================
// Nova-Scheduler — Job Service
// ============================================
// Handles all job types: immediate, delayed, scheduled, recurring, batch

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, AppError } from '../../middleware/errorHandler';
import { CreateJobInput, UpdateJobInput, JobFilterInput, BatchJobInput } from './job.schema';
import { buildPaginationMeta } from '../../shared/utils/apiResponse';
import { emitJobEvent } from '../../socket';
import { SocketEvents, JobStatus } from '../../shared/types';

export class JobService {
  /**
   * Create a single job (immediate, delayed, scheduled, or recurring)
   */
  async create(input: CreateJobInput) {
    // Validate queue exists and is not paused
    const queue = await prisma.queue.findUnique({
      where: { id: input.queueId },
      include: { retryPolicy: true },
    });

    if (!queue) throw new NotFoundError('Queue');
    if (queue.isPaused) throw new AppError('Queue is paused. Cannot create jobs.', 400);

    // Set initial status based on job type
    let status: string = 'QUEUED';
    if (input.type === 'DELAYED' || input.type === 'SCHEDULED') {
      if (!input.scheduledAt) throw new AppError('scheduledAt is required for DELAYED/SCHEDULED jobs', 400);
      status = 'SCHEDULED';
    }
    if (input.type === 'RECURRING') {
      if (!input.cronExpression) throw new AppError('cronExpression is required for RECURRING jobs', 400);
      status = 'SCHEDULED';
    }

    // Use queue's retry policy max attempts if not specified
    const maxRetries = input.maxRetries ?? queue.retryPolicy?.maxAttempts ?? 3;

    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.job.create({
        data: {
          name: input.name,
          type: input.type as any,
          payload: input.payload as any,
          status: status as any,
          priority: input.priority,
          maxRetries,
          timeoutMs: input.timeoutMs,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          cronExpression: input.cronExpression,
          batchId: input.batchId,
          queueId: input.queueId,
        },
        include: {
          queue: { select: { id: true, name: true } },
        },
      });

      // Create scheduled job entry for RECURRING jobs
      if (input.type === 'RECURRING' && input.cronExpression) {
        await tx.scheduledJob.create({
          data: {
            jobId: newJob.id,
            cronExpression: input.cronExpression,
            isActive: true,
          },
        });
      }

      // Create initial job log
      await tx.jobLog.create({
        data: {
          jobId: newJob.id,
          level: 'INFO',
          message: `Job created with type ${input.type} and priority ${input.priority}`,
        },
      });

      return newJob;
    });

    // Emit real-time event
    emitJobEvent(SocketEvents.JOB_CREATED, job);

    logger.info(`Job created: ${job.name} (${job.id}) [${job.type}]`);
    return job;
  }

  /**
   * Create batch jobs — atomically creates multiple jobs
   */
  async createBatch(input: BatchJobInput) {
    const queue = await prisma.queue.findUnique({ where: { id: input.queueId } });
    if (!queue) throw new NotFoundError('Queue');
    if (queue.isPaused) throw new AppError('Queue is paused', 400);

    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const jobs = await prisma.$transaction(
      input.jobs.map((job) =>
        prisma.job.create({
          data: {
            name: job.name,
            type: 'BATCH',
            payload: job.payload as any,
            status: 'QUEUED',
            priority: job.priority,
            batchId,
            queueId: input.queueId,
          },
        })
      )
    );

    logger.info(`Batch created: ${batchId} with ${jobs.length} jobs`);
    return { batchId, count: jobs.length, jobs };
  }

  /**
   * Find all jobs with filtering, pagination, and sorting
   */
  async findAll(filter: JobFilterInput) {
    const where: Prisma.JobWhereInput = {};

    if (filter.status) where.status = filter.status as any;
    if (filter.type) where.type = filter.type as any;
    if (filter.priority) where.priority = filter.priority;
    if (filter.queueId) where.queueId = filter.queueId;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { batchId: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          queue: { select: { id: true, name: true } },
          _count: { select: { executions: true, logs: true } },
        },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        orderBy: { [filter.sortBy]: filter.sortOrder },
      }),
      prisma.job.count({ where }),
    ]);

    return { jobs, meta: buildPaginationMeta(filter.page, filter.limit, total) };
  }

  /**
   * Get a job by ID with full details (executions, logs)
   */
  async findById(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          select: {
            id: true,
            name: true,
            retryPolicy: true,
            project: { select: { id: true, name: true } },
          },
        },
        executions: {
          include: {
            worker: { select: { id: true, name: true } },
          },
          orderBy: { attempt: 'desc' },
        },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
        scheduledJob: true,
        deadLetterEntry: true,
      },
    });

    if (!job) throw new NotFoundError('Job');
    return job;
  }

  /**
   * Update a job (limited to cancellation and metadata)
   */
  async update(id: string, input: UpdateJobInput) {
    const job = await this.findById(id);

    // Can only cancel jobs that are not already completed/failed
    if (input.status === 'CANCELLED') {
      const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'];
      if (terminalStatuses.includes(job.status)) {
        throw new AppError(`Cannot cancel a job with status ${job.status}`, 400);
      }
    }

    const updated = await prisma.job.update({
      where: { id },
      data: input as any,
      include: {
        queue: { select: { id: true, name: true } },
      },
    });

    emitJobEvent(SocketEvents.JOB_COMPLETED, updated);
    return updated;
  }

  /**
   * Retry a failed job — resets status and retry count
   */
  async retry(id: string) {
    const job = await this.findById(id);

    if (job.status !== 'FAILED' && job.status !== 'TIMED_OUT' && job.status !== 'CANCELLED') {
      throw new AppError('Can only retry failed, timed out, or cancelled jobs', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.job.update({
        where: { id },
        data: {
          status: 'QUEUED',
          retryCount: 0,
          lockedBy: null,
          lockedAt: null,
          startedAt: null,
          completedAt: null,
          failedAt: null,
        },
      });

      await tx.jobLog.create({
        data: {
          jobId: id,
          level: 'INFO',
          message: 'Job manually retried',
        },
      });

      // Remove from DLQ if present
      await tx.deadLetterQueue.deleteMany({
        where: { originalJobId: id },
      });

      return result;
    });

    emitJobEvent(SocketEvents.JOB_RETRYING, updated);
    logger.info(`Job retried: ${id}`);
    return updated;
  }

  /**
   * Get job execution logs
   */
  async getLogs(jobId: string, page = 1, limit = 50) {
    const [logs, total] = await Promise.all([
      prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobLog.count({ where: { jobId } }),
    ]);

    return { logs, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Delete a job
   */
  async delete(id: string) {
    await this.findById(id);
    await prisma.job.delete({ where: { id } });
    logger.info(`Job deleted: ${id}`);
  }
}

export default new JobService();
