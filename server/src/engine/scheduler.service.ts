// ============================================
// Nova-Scheduler — Scheduler Service (Singleton)
// ============================================
// Orchestrates the scheduling engine:
// - Manages recurring (cron) jobs via node-cron
// - Promotes RETRYING/SCHEDULED jobs to QUEUED when due
// - Detects stale workers
// - Manages the worker manager lifecycle

import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import workerManager from './worker.manager';
import workerService from '../modules/workers/worker.service';
import { emitMetricsUpdate } from '../socket';

export class SchedulerService {
  private static instance: SchedulerService;
  private isRunning = false;
  private cronJobs = new Map<string, cron.ScheduledTask>();
  private promotionInterval: NodeJS.Timeout | null = null;
  private staleCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Start the scheduler engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Start the worker manager
    await workerManager.start();

    // 2. Load and schedule all active recurring jobs
    await this.loadRecurringJobs();

    // 3. Start the job promotion loop (SCHEDULED/RETRYING → QUEUED)
    this.startPromotionLoop();

    // 4. Start stale worker detection
    this.startStaleWorkerCheck();

    // 5. Start periodic metrics broadcast
    this.startMetricsBroadcast();

    logger.info('⚙️  Scheduler engine fully started');
  }

  /**
   * Stop the scheduler engine (graceful shutdown)
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Stop all cron jobs
    this.cronJobs.forEach((task, id) => {
      task.stop();
      logger.debug(`Cron job ${id} stopped`);
    });
    this.cronJobs.clear();

    // Stop intervals
    if (this.promotionInterval) clearInterval(this.promotionInterval);
    if (this.staleCheckInterval) clearInterval(this.staleCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Stop worker manager
    await workerManager.stop();

    logger.info('Scheduler engine stopped');
  }

  /**
   * Load all active recurring (cron) jobs from the database
   * and schedule them with node-cron
   */
  private async loadRecurringJobs(): Promise<void> {
    const scheduledJobs = await prisma.scheduledJob.findMany({
      where: { isActive: true },
      include: {
        job: {
          select: {
            id: true,
            name: true,
            queueId: true,
            payload: true,
            priority: true,
            maxRetries: true,
            timeoutMs: true,
          },
        },
      },
    });

    for (const scheduled of scheduledJobs) {
      this.scheduleCronJob(scheduled);
    }

    logger.info(`Loaded ${scheduledJobs.length} recurring jobs`);
  }

  /**
   * Schedule a single cron job
   */
  private scheduleCronJob(scheduled: any): void {
    if (!cron.validate(scheduled.cronExpression)) {
      logger.error(`Invalid cron expression for job ${scheduled.jobId}: ${scheduled.cronExpression}`);
      return;
    }

    const task = cron.schedule(scheduled.cronExpression, async () => {
      try {
        // Create a new job instance for this cron run
        await prisma.$transaction([
          prisma.job.create({
            data: {
              name: `${scheduled.job.name} (run ${scheduled.runCount + 1})`,
              type: 'RECURRING',
              payload: scheduled.job.payload as any,
              status: 'QUEUED',
              priority: scheduled.job.priority,
              maxRetries: scheduled.job.maxRetries,
              timeoutMs: scheduled.job.timeoutMs,
              queueId: scheduled.job.queueId,
            },
          }),
          prisma.scheduledJob.update({
            where: { id: scheduled.id },
            data: {
              lastRunAt: new Date(),
              runCount: { increment: 1 },
            },
          }),
        ]);

        logger.info(`Cron job triggered: ${scheduled.job.name}`);
      } catch (error) {
        logger.error(`Failed to trigger cron job ${scheduled.jobId}:`, error);
      }
    });

    this.cronJobs.set(scheduled.id, task);
  }

  /**
   * Promote SCHEDULED and RETRYING jobs to QUEUED when their time comes
   * Runs every 5 seconds
   */
  private startPromotionLoop(): void {
    this.promotionInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Promote scheduled/delayed jobs that are due
        const promoted = await prisma.job.updateMany({
          where: {
            status: { in: ['SCHEDULED', 'RETRYING'] },
            scheduledAt: { lte: new Date() },
          },
          data: {
            status: 'QUEUED',
            scheduledAt: null,
          },
        });

        if (promoted.count > 0) {
          logger.info(`Promoted ${promoted.count} jobs to QUEUED`);
        }

        // Release stale locks (jobs claimed but not started within 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 120000);
        const staleLocks = await prisma.job.updateMany({
          where: {
            status: 'CLAIMED',
            lockedAt: { lt: twoMinutesAgo },
          },
          data: {
            status: 'QUEUED',
            lockedBy: null,
            lockedAt: null,
          },
        });

        if (staleLocks.count > 0) {
          logger.warn(`Released ${staleLocks.count} stale job locks`);
        }
      } catch (error) {
        logger.error('Job promotion loop error:', error);
      }
    }, 5000);
  }

  /**
   * Detect and mark stale workers every 30 seconds
   */
  private startStaleWorkerCheck(): void {
    this.staleCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await workerService.markStaleWorkers();
    }, 30000);
  }

  /**
   * Broadcast updated metrics every 10 seconds
   */
  private startMetricsBroadcast(): void {
    this.metricsInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const [jobCounts, workerCounts] = await Promise.all([
          prisma.job.groupBy({
            by: ['status'],
            _count: { status: true },
          }),
          prisma.worker.groupBy({
            by: ['status'],
            _count: { status: true },
          }),
        ]);

        const statusMap: Record<string, number> = {};
        jobCounts.forEach((s) => { statusMap[s.status] = s._count.status; });

        const workerMap: Record<string, number> = {};
        workerCounts.forEach((w) => { workerMap[w.status] = w._count.status; });

        emitMetricsUpdate({
          jobsByStatus: statusMap,
          workersByStatus: workerMap,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Silently ignore metrics errors
      }
    }, 10000);
  }
}

export default SchedulerService;
