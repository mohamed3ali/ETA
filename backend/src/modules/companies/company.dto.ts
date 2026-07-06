import { z } from 'zod';

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  nameEn: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  defaultCurrency: z.string().length(3).optional(),
  logoUrl: z.string().url().optional(),
});

export const updateEtaCredentialsSchema = z.object({
  etaClientId: z.string().min(1).max(255),
  etaClientSecret: z.string().min(1).max(500),
  etaEnvironment: z.enum(['preprod', 'production']).default('preprod'),
});

export const createCompanySchema = z
  .object({
    name: z.string().min(2).max(255),
    taxRegistrationNumber: z.string().min(5).max(60),
    nameEn: z.string().max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    defaultCurrency: z.string().length(3).default('EGP').optional(),
    etaClientId: z.string().max(255).optional(),
    etaClientSecret: z.string().max(500).optional(),
    etaEnvironment: z.enum(['preprod', 'production']).optional(),
  })
  .refine(
    (data) => {
      const hasId = !!data.etaClientId?.trim();
      const hasSecret = !!data.etaClientSecret?.trim();
      return hasId === hasSecret;
    },
    { message: 'ETA Client ID and Secret must be provided together', path: ['etaClientId'] },
  );

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type UpdateEtaCredentialsInput = z.infer<typeof updateEtaCredentialsSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
