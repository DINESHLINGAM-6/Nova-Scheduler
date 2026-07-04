import { Request, Response } from 'express';
import workerService from './worker.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class WorkerController {
  async register(req: Request, res: Response): Promise<void> {
    const worker = await workerService.register(req.body);
    sendCreated(res, worker, 'Worker registered');
  }

  async heartbeat(req: Request, res: Response): Promise<void> {
    const result = await workerService.heartbeat(req.params.id, req.body);
    sendSuccess(res, result);
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query;
    const result = await workerService.findAll(Number(page) || undefined, Number(limit) || undefined);
    sendSuccess(res, result.workers, 'Workers retrieved', 200, result.meta);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const worker = await workerService.findById(req.params.id);
    sendSuccess(res, worker);
  }

  async deregister(req: Request, res: Response): Promise<void> {
    const worker = await workerService.deregister(req.params.id);
    sendSuccess(res, worker, 'Worker deregistered');
  }
}

export default new WorkerController();
