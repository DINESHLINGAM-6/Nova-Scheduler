import { Request, Response } from 'express';
import jobService from './job.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class JobController {
  async create(req: Request, res: Response): Promise<void> {
    const job = await jobService.create(req.body);
    sendCreated(res, job, 'Job created successfully');
  }

  async createBatch(req: Request, res: Response): Promise<void> {
    const result = await jobService.createBatch(req.body);
    sendCreated(res, result, `Batch of ${result.count} jobs created`);
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const result = await jobService.findAll(req.query as any);
    sendSuccess(res, result.jobs, 'Jobs retrieved', 200, result.meta);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const job = await jobService.findById(req.params.id);
    sendSuccess(res, job);
  }

  async update(req: Request, res: Response): Promise<void> {
    const job = await jobService.update(req.params.id, req.body);
    sendSuccess(res, job, 'Job updated successfully');
  }

  async retry(req: Request, res: Response): Promise<void> {
    const job = await jobService.retry(req.params.id);
    sendSuccess(res, job, 'Job queued for retry');
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query;
    const result = await jobService.getLogs(
      req.params.id,
      Number(page) || undefined,
      Number(limit) || undefined
    );
    sendSuccess(res, result.logs, 'Logs retrieved', 200, result.meta);
  }

  async delete(req: Request, res: Response): Promise<void> {
    await jobService.delete(req.params.id);
    sendSuccess(res, null, 'Job deleted successfully');
  }
}

export default new JobController();
