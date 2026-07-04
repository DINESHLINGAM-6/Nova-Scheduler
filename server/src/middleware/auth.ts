import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload, UserRole } from '../shared/types';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

declare global { namespace Express { interface Request { user?: JwtPayload; } } }

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) throw new UnauthorizedError('Access token is required');
    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedError('Invalid token format');
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) { next(error); return; }
    if (error instanceof jwt.JsonWebTokenError) { next(new UnauthorizedError('Invalid or expired token')); return; }
    if (error instanceof jwt.TokenExpiredError) { next(new UnauthorizedError('Token has expired')); return; }
    next(new UnauthorizedError('Authentication failed'));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
    if (!roles.includes(req.user.role)) { next(new ForbiddenError('Insufficient permissions')); return; }
    next();
  };
}

export default { authenticate, authorize };
