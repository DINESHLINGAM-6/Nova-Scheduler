import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { sendError } from '../shared/utils/apiResponse';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404); }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') { super(message, 409); }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') { super(message, 400); }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    logger.warn('Validation error', { errors: formattedErrors });
    sendError(res, 'Validation failed', 400, JSON.stringify(formattedErrors));
    return;
  }
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, { statusCode: err.statusCode });
    sendError(res, err.message, err.statusCode);
    return;
  }
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') { sendError(res, 'A record with this value already exists', 409); return; }
    if (prismaError.code === 'P2025') { sendError(res, 'Record not found', 404); return; }
  }
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  sendError(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message, 500);
}

export default errorHandler;
