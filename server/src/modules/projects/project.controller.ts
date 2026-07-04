import { Request, Response } from 'express';
import projectService from './project.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class ProjectController {
  async create(req: Request, res: Response): Promise<void> {
    const project = await projectService.create(req.body, req.user!.userId);
    sendCreated(res, project, 'Project created successfully');
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const { orgId, page, limit } = req.query;
    const result = await projectService.findAll(
      orgId as string,
      Number(page) || undefined,
      Number(limit) || undefined
    );
    sendSuccess(res, result.projects, 'Projects retrieved', 200, result.meta);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const project = await projectService.findById(req.params.id);
    sendSuccess(res, project);
  }

  async update(req: Request, res: Response): Promise<void> {
    const project = await projectService.update(req.params.id, req.body);
    sendSuccess(res, project, 'Project updated successfully');
  }

  async delete(req: Request, res: Response): Promise<void> {
    await projectService.delete(req.params.id);
    sendSuccess(res, null, 'Project deleted successfully');
  }
}

export default new ProjectController();
