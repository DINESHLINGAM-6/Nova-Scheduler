import { z } from 'zod';

export const createQueueSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  projectId: z.string().uuid(),
  concurrencyLimit: z.number().int().min(1).max(100).default(5),
  maxRatePerMinute: z.number().int().min(1).max(10000).optional(),
  retryPolicy: z.object({
    name: z.string().min(2).max(100),
    type: z.enum(['FIXED', 'LINEAR', 'EXPONENTIAL']).default('EXPONENTIAL'),
    maxAttempts: z.number().int().min(1).max(20).default(3),
    baseDelayMs: z.number().int().min(100).max(600000).default(1000),
    maxDelayMs: z.number().int().min(100).max(3600000).default(300000),
    backoffMultiplier: z.number().min(1).max(10).default(2),
  }).optional(),
});

export const updateQueueSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  concurrencyLimit: z.number().int().min(1).max(100).optional(),
  maxRatePerMinute: z.number().int().min(1).max(10000).optional().nullable(),
  isPaused: z.boolean().optional(),
});

export type CreateQueueInput = z.infer<typeof createQueueSchema>;
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;
