// ============================================
// Nova-Scheduler — Worker Manager
// ============================================
// Manages the internal worker pool that processes jobs

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config';
import queueManager from './queue.manager';
import workerService from '../modules/workers/worker.service';
import { v4 as uuid } from 'uuid';
import os from 'os';

export class WorkerManager {
  private workerId: string | null = null;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Start the internal worker
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    // Register this server instance as a worker
    const workerName = `worker-${os.hostname()}-${process.pid}`;
    const worker = await workerService.register({
      name: workerName,
      hostname: os.hostname(),
      pid: process.pid,
      concurrency: config.maxConcurrentJobs,
    });

    this.workerId = worker.id;
    this.isRunning = true;

    // Start polling for jobs
    this.startPolling();

    // Start heartbeat
    this.startHeartbeat();

    logger.info(`Worker manager started: ${workerName} (${this.workerId})`);
  }

  /**
   * Stop the worker (graceful shutdown)
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Wait for active jobs to finish
    const activeCount = queueManager.getActiveJobCount();
    if (activeCount > 0) {
      logger.info(`Waiting for ${activeCount} active jobs to finish...`);
      // Mark worker as DRAINING
      if (this.workerId) {
        await prisma.worker.update({
          where: { id: this.workerId },
          data: { status: 'DRAINING' },
        });
      }

      // Wait up to 30 seconds for jobs to complete
      let waitTime = 0;
      while (queueManager.getActiveJobCount() > 0 && waitTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
    }

    // Deregister worker
    if (this.workerId) {
      await workerService.deregister(this.workerId);
    }

    logger.info('Worker manager stopped');
  }

  /**
   * Poll for available jobs at regular intervals
   */
  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning || !this.workerId) return;

      const activeCount = queueManager.getActiveJobCount();
      if (activeCount >= config.maxConcurrentJobs) return;

      // Claim and execute jobs up to concurrency limit
      const slotsAvailable = config.maxConcurrentJobs - activeCount;

      for (let i = 0; i < slotsAvailable; i++) {
        const jobId = await queueManager.claimNextJob(this.workerId);
        if (!jobId) break; // No more jobs available

        // Execute in background (non-blocking)
        queueManager.executeJob(jobId, this.workerId).catch((error) => {
          logger.error(`Error executing job ${jobId}:`, error);
        });
      }
    }, config.jobPollIntervalMs);
  }

  /**
   * Send periodic heartbeats to indicate worker health
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isRunning || !this.workerId) return;

      try {
        const cpuUsage = os.loadavg()[0]; // 1-minute load average
        const totalMem = os.totalmem() / (1024 * 1024); // MB
        const freeMem = os.freemem() / (1024 * 1024); // MB
        const memoryUsage = totalMem - freeMem;

        await workerService.heartbeat(this.workerId, {
          activeJobs: queueManager.getActiveJobCount(),
          cpuUsage: Number(cpuUsage.toFixed(2)),
          memoryUsage: Number(memoryUsage.toFixed(2)),
        });
      } catch (error) {
        logger.error('Failed to send heartbeat:', error);
      }
    }, 15000); // Every 15 seconds
  }

  /**
   * Get worker ID
   */
  getWorkerId(): string | null {
    return this.workerId;
  }
}

export default new WorkerManager();
