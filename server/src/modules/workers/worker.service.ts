// ============================================
// Nova-Scheduler — Worker Service
// ============================================

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../middleware/errorHandler';
import { buildPaginationMeta } from '../../shared/utils/apiResponse';
import { emitWorkerEvent } from '../../socket';
import { SocketEvents } from '../../shared/types';
import { WORKER_STALE_THRESHOLD_MS, DEFAULT_PAGE, DEFAULT_LIMIT } from '../../shared/constants';

export class WorkerService {
  async register(data: { name: string; hostname?: string; pid?: number; concurrency?: number; queues?: string[] }) {
    const worker = await prisma.worker.upsert({
      where: { name: data.name },
      create: {
        name: data.name,
        hostname: data.hostname,
        pid: data.pid,
        concurrency: data.concurrency || 5,
        queues: data.queues || [],
        status: 'IDLE',
        lastHeartbeat: new Date(),
      },
      update: {
        hostname: data.hostname,
        pid: data.pid,
        status: 'IDLE',
        lastHeartbeat: new Date(),
      },
    });

    emitWorkerEvent(SocketEvents.WORKER_ONLINE, worker);
    logger.info(`Worker registered: ${worker.name} (${worker.id})`);
    return worker;
  }

  async heartbeat(workerId: string, data: { activeJobs: number; cpuUsage?: number; memoryUsage?: number }) {
    const [worker, heartbeat] = await prisma.$transaction([
      prisma.worker.update({
        where: { id: workerId },
        data: {
          lastHeartbeat: new Date(),
          status: data.activeJobs > 0 ? 'BUSY' : 'IDLE',
        },
      }),
      prisma.workerHeartbeat.create({
        data: {
          workerId,
          activeJobs: data.activeJobs,
          cpuUsage: data.cpuUsage,
          memoryUsage: data.memoryUsage,
          status: data.activeJobs > 0 ? 'BUSY' : 'IDLE',
        },
      }),
    ]);

    emitWorkerEvent(SocketEvents.WORKER_HEARTBEAT, { worker, heartbeat });
    return { worker, heartbeat };
  }

  async findAll(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        include: {
          _count: { select: { executions: true, heartbeats: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastHeartbeat: 'desc' },
      }),
      prisma.worker.count(),
    ]);

    return { workers, meta: buildPaginationMeta(page, limit, total) };
  }

  async findById(id: string) {
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            job: { select: { id: true, name: true, status: true } },
          },
        },
        _count: { select: { executions: true } },
      },
    });

    if (!worker) throw new NotFoundError('Worker');
    return worker;
  }

  async deregister(workerId: string) {
    const worker = await prisma.worker.update({
      where: { id: workerId },
      data: { status: 'OFFLINE' },
    });

    emitWorkerEvent(SocketEvents.WORKER_OFFLINE, worker);
    logger.info(`Worker deregistered: ${worker.name}`);
    return worker;
  }

  /**
   * Mark stale workers as OFFLINE
   * Called periodically by the scheduler engine
   */
  async markStaleWorkers() {
    const threshold = new Date(Date.now() - WORKER_STALE_THRESHOLD_MS);

    const staleWorkers = await prisma.worker.updateMany({
      where: {
        status: { not: 'OFFLINE' },
        lastHeartbeat: { lt: threshold },
      },
      data: { status: 'OFFLINE' },
    });

    if (staleWorkers.count > 0) {
      logger.warn(`Marked ${staleWorkers.count} stale workers as OFFLINE`);
    }

    return staleWorkers.count;
  }
}

export default new WorkerService();
