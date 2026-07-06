import { z } from 'zod';

export const createBranchSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  governorate: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
