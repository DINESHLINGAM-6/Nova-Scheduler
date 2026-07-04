import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
