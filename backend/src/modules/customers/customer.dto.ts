import { z } from 'zod';
import { CustomerType } from './customer.entity';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  type: z.nativeEnum(CustomerType).default(CustomerType.BUSINESS),
  taxRegistrationNumber: z.string().max(60).optional(),
  nationalId: z.string().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  governorate: z.string().max(100).optional(),
  country: z.string().length(2).default('EG'),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
