// ============================================
// Nova-Scheduler — Metrics Service
// ============================================

import { prisma } from '../../config/database';

export class MetricsService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics() {
    // Get job counts by status
    const jobsByStatus = await prisma.job.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusMap: Record<string, number> = {};
    let totalJobs = 0;
    jobsByStatus.forEach((s) => {
      statusMap[s.status] = s._count.status;
      totalJobs += s._count.status;
    });

    // Get job counts by type
    const jobsByType = await prisma.job.groupBy({
      by: ['type'],
      _count: { type: true },
    });

    const typeMap: Record<string, number> = {};
    jobsByType.forEach((t) => {
      typeMap[t.type] = t._count.type;
    });

    // Success rate & average execution time
    const completedCount = statusMap['COMPLETED'] || 0;
    const failedCount = statusMap['FAILED'] || 0;
    const processedTotal = completedCount + failedCount;

    const avgExecTime = await prisma.jobExecution.aggregate({
      where: { status: 'COMPLETED', durationMs: { not: null } },
      _avg: { durationMs: true },
    });

    // Throughput — last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentJobs = await prisma.job.findMany({
      where: {
        updatedAt: { gte: sevenDaysAgo },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
      select: {
        status: true,
        updatedAt: true,
      },
    });

    // Group by date
    const throughputMap = new Map<string, { completed: number; failed: number }>();
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      throughputMap.set(dateStr, { completed: 0, failed: 0 });
    }

    recentJobs.forEach((job) => {
      const dateStr = job.updatedAt.toISOString().split('T')[0];
      const entry = throughputMap.get(dateStr);
      if (entry) {
        if (job.status === 'COMPLETED') entry.completed++;
        else entry.failed++;
      }
    });

    const throughput = Array.from(throughputMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .reverse();

    // Queue health
    const queues = await prisma.queue.findMany({
      select: {
        id: true,
        name: true,
        isPaused: true,
        _count: { select: { jobs: true, deadLetterEntries: true } },
      },
    });

    const queueHealth = await Promise.all(
      queues.map(async (q) => {
        const statusCounts = await prisma.job.groupBy({
          by: ['status'],
          where: { queueId: q.id },
          _count: { status: true },
        });
        const counts: Record<string, number> = {};
        statusCounts.forEach((s) => {
          counts[s.status] = s._count.status;
        });

        return {
          queueId: q.id,
          queueName: q.name,
          isPaused: q.isPaused,
          pending: (counts['QUEUED'] || 0) + (counts['SCHEDULED'] || 0),
          processing: (counts['CLAIMED'] || 0) + (counts['RUNNING'] || 0),
          completed: counts['COMPLETED'] || 0,
          failed: counts['FAILED'] || 0,
          deadLetterCount: q._count.deadLetterEntries,
        };
      })
    );

    // Worker utilization
    const workers = await prisma.worker.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        lastHeartbeat: true,
        _count: { select: { executions: true } },
      },
    });

    const workerUtilization = workers.map((w) => ({
      workerId: w.id,
      workerName: w.name,
      status: w.status,
      lastHeartbeat: w.lastHeartbeat,
      totalExecuted: w._count.executions,
    }));

    return {
      totalJobs,
      activeJobs: (statusMap['QUEUED'] || 0) + (statusMap['RUNNING'] || 0) + (statusMap['CLAIMED'] || 0),
      completedJobs: completedCount,
      failedJobs: failedCount,
      successRate: processedTotal > 0 ? Number(((completedCount / processedTotal) * 100).toFixed(2)) : 0,
      avgExecutionTimeMs: Math.round(avgExecTime._avg.durationMs || 0),
      jobsByStatus: statusMap,
      jobsByType: typeMap,
      throughput,
      queueHealth,
      workerUtilization,
    };
  }

  /**
   * Get dead letter queue entries
   */
  async getDeadLetterQueue(page = 1, limit = 20) {
    const [entries, total] = await Promise.all([
      prisma.deadLetterQueue.findMany({
        include: {
          originalJob: { select: { id: true, name: true, type: true } },
          queue: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { failedAt: 'desc' },
      }),
      prisma.deadLetterQueue.count(),
    ]);

    return { entries, total };
  }
}

export default new MetricsService();
