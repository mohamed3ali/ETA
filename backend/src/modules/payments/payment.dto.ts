import { z } from 'zod';
import { PaymentMethod } from './payment.entity';

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default('EGP'),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

export const listPaymentSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(['ASC', 'DESC']).default('DESC'),
  search: z.string().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ListPaymentQuery = z.infer<typeof listPaymentSchema>;
