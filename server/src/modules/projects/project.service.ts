import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../middleware/errorHandler';
import { CreateProjectInput, UpdateProjectInput } from './project.schema';
import { buildPaginationMeta } from '../../shared/utils/apiResponse';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../../shared/constants';

export class ProjectService {
  async create(input: CreateProjectInput, userId: string) {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: input.organizationId,
        createdById: userId,
      },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { queues: true } },
      },
    });

    logger.info(`Project created: ${project.name} (${project.id})`);
    return project;
  }

  async findAll(orgId?: string, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    const where = orgId ? { organizationId: orgId } : {};
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { queues: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, meta: buildPaginationMeta(page, limit, total) };
  }

  async findById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        queues: {
          include: {
            retryPolicy: true,
            _count: { select: { jobs: true } },
          },
        },
        _count: { select: { queues: true } },
      },
    });

    if (!project) throw new NotFoundError('Project');
    return project;
  }

  async update(id: string, input: UpdateProjectInput) {
    await this.findById(id);
    return prisma.project.update({
      where: { id },
      data: input,
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.project.delete({ where: { id } });
    logger.info(`Project deleted: ${id}`);
  }
}

export default new ProjectService();
