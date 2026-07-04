import { Request, Response } from 'express';
import orgService from './org.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class OrgController {
  async create(req: Request, res: Response): Promise<void> {
    const org = await orgService.create(req.body, req.user!.userId);
    sendCreated(res, org, 'Organization created successfully');
  }

  async findAll(_req: Request, res: Response): Promise<void> {
    const orgs = await orgService.findAll();
    sendSuccess(res, orgs);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const org = await orgService.findById(req.params.id);
    sendSuccess(res, org);
  }

  async update(req: Request, res: Response): Promise<void> {
    const org = await orgService.update(req.params.id, req.body);
    sendSuccess(res, org, 'Organization updated successfully');
  }

  async delete(req: Request, res: Response): Promise<void> {
    await orgService.delete(req.params.id);
    sendSuccess(res, null, 'Organization deleted successfully');
  }
}

export default new OrgController();
