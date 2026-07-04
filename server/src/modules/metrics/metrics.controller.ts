import { Request, Response } from 'express';
import metricsService from './metrics.service';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { buildPaginationMeta } from '../../shared/utils/apiResponse';

export class MetricsController {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    const metrics = await metricsService.getDashboardMetrics();
    sendSuccess(res, metrics, 'Dashboard metrics retrieved');
  }

  async getDeadLetterQueue(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query;
    const result = await metricsService.getDeadLetterQueue(
      Number(page) || 1,
      Number(limit) || 20
    );
    sendSuccess(res, result.entries, 'Dead letter queue retrieved', 200,
      buildPaginationMeta(Number(page) || 1, Number(limit) || 20, result.total)
    );
  }
}

export default new MetricsController();
