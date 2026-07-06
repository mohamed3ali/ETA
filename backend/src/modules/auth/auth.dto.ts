import { z } from 'zod';

export const registerSchema = z.object({
  // company
  companyName: z.string().min(2).max(255),
  taxRegistrationNumber: z.string().min(5).max(60),
  // owner user
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(72),
  phone: z.string().max(50).optional(),
  locale: z.enum(['en', 'ar']).default('en'),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const switchCompanySchema = z.object({
  companyId: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SwitchCompanyInput = z.infer<typeof switchCompanySchema>;
