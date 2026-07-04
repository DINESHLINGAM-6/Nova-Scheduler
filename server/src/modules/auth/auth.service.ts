// ============================================
// Nova-Scheduler — Auth Service
// ============================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { JwtPayload, UserRole } from '../../shared/types';
import { AppError, ConflictError, UnauthorizedError } from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';

export class AuthService {
  /**
   * Register a new user with optional organization creation
   */
  async register(input: RegisterInput) {
    const { email, password, name, organizationName } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with optional organization
    const result = await prisma.$transaction(async (tx) => {
      let organizationId: string | undefined;

      if (organizationName) {
        const slug = organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const org = await tx.organization.create({
          data: {
            name: organizationName,
            slug: `${slug}-${Date.now().toString(36)}`,
          },
        });
        organizationId = org.id;
      }

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: organizationId ? 'ADMIN' : 'MEMBER', // Creator is admin
          organizationId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          createdAt: true,
        },
      });

      return user;
    });

    // Generate JWT
    const token = this.generateToken({
      userId: result.id,
      email: result.email,
      role: result.role as UserRole,
      orgId: result.organizationId || undefined,
    });

    logger.info(`User registered: ${email}`);

    return { user: result, token };
  }

  /**
   * Authenticate user with email and password
   */
  async login(input: LoginInput) {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      orgId: user.organizationId || undefined,
    });

    logger.info(`User logged in: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
      },
      token,
    };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}

export default new AuthService();
