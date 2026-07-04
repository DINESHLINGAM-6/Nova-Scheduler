import { z } from 'zod';

export const createJobSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH']).default('IMMEDIATE'),
  payload: z.record(z.unknown()).default({}),
  queueId: z.string().uuid(),
  priority: z.number().int().min(1).max(5).default(3),
  maxRetries: z.number().int().min(0).max(20).default(3),
  timeoutMs: z.number().int().min(1000).max(3600000).default(30000),
  scheduledAt: z.string().datetime().optional(), // For DELAYED/SCHEDULED jobs
  cronExpression: z.string().optional(),         // For RECURRING jobs
  batchId: z.string().optional(),                // For BATCH jobs
});

export const updateJobSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  payload: z.record(z.unknown()).optional(),
  status: z.enum(['CANCELLED']).optional(), // Users can only cancel
});

export const jobFilterSchema = z.object({
  status: z.enum(['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED', 'TIMED_OUT']).optional(),
  type: z.enum(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH']).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  queueId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'priority', 'status', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const batchJobSchema = z.object({
  queueId: z.string().uuid(),
  jobs: z.array(z.object({
    name: z.string().min(2).max(200),
    payload: z.record(z.unknown()).default({}),
    priority: z.number().int().min(1).max(5).default(3),
  })).min(1).max(100),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobFilterInput = z.infer<typeof jobFilterSchema>;
export type BatchJobInput = z.infer<typeof batchJobSchema>;
