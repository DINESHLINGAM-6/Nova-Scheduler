import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200, meta?: PaginationMeta): Response {
  const response: ApiResponse<T> = { success: true, message, data, ...(meta && { meta }) };
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, message: string, statusCode = 500, error?: string): Response {
  const response: ApiResponse = { success: false, message, ...(error && { error }) };
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}
