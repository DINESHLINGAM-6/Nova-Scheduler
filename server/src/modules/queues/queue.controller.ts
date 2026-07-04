import { Request, Response } from 'express';
import queueService from './queue.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class QueueController {
  async create(req: Request, res: Response): Promise<void> {
    const queue = await queueService.create(req.body);
    sendCreated(res, queue, 'Queue created successfully');
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const { projectId, page, limit } = req.query;
    const result = await queueService.findAll(
      projectId as string,
      Number(page) || undefined,
      Number(limit) || undefined
    );
    sendSuccess(res, result.queues, 'Queues retrieved', 200, result.meta);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const queue = await queueService.findById(req.params.id);
    sendSuccess(res, queue);
  }

  async update(req: Request, res: Response): Promise<void> {
    const queue = await queueService.update(req.params.id, req.body);
    sendSuccess(res, queue, 'Queue updated successfully');
  }

  async delete(req: Request, res: Response): Promise<void> {
    await queueService.delete(req.params.id);
    sendSuccess(res, null, 'Queue deleted successfully');
  }

  async getStats(req: Request, res: Response): Promise<void> {
    const stats = await queueService.getStats(req.params.id);
    sendSuccess(res, stats);
  }

  async pause(req: Request, res: Response): Promise<void> {
    const queue = await queueService.pause(req.params.id);
    sendSuccess(res, queue, 'Queue paused');
  }

  async resume(req: Request, res: Response): Promise<void> {
    const queue = await queueService.resume(req.params.id);
    sendSuccess(res, queue, 'Queue resumed');
  }
}

export default new QueueController();
