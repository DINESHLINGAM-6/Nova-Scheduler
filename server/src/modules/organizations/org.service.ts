// ============================================
// Nova-Scheduler — Organization Service
// ============================================

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { CreateOrgInput, UpdateOrgInput } from './org.schema';

export class OrgService {
  async create(input: CreateOrgInput, userId: string) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const org = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug: `${slug}-${Date.now().toString(36)}`,
        },
      });

      // Assign the creator as ADMIN of the organization
      await tx.user.update({
        where: { id: userId },
        data: { organizationId: organization.id, role: 'ADMIN' },
      });

      return organization;
    });

    logger.info(`Organization created: ${org.name} (${org.id})`);
    return org;
  }

  async findById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, projects: true } },
      },
    });

    if (!org) throw new NotFoundError('Organization');
    return org;
  }

  async findAll() {
    return prisma.organization.findMany({
      include: {
        _count: { select: { users: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, input: UpdateOrgInput) {
    await this.findById(id); // Ensure exists
    return prisma.organization.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.organization.delete({ where: { id } });
    logger.info(`Organization deleted: ${id}`);
  }
}

export default new OrgService();
