import { z } from 'zod';
import { InvoiceType } from '../invoices/invoice.entity';
import { RecurringPeriod } from './recurring-invoice.entity';

export const recurringItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(255),
  etaItemCode: z.string().max(100).optional().nullable(),
  etaCodeType: z.enum(['GS1', 'EGS']).default('GS1'),
  unitType: z.string().max(20).default('EA'),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(14),
});

export const createRecurringSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  customerId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  type: z.nativeEnum(InvoiceType).default(InvoiceType.INVOICE),
  period: z.nativeEnum(RecurringPeriod),
  nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoSubmit: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  currency: z.string().length(3).default('EGP'),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(recurringItemSchema).min(1).max(200),
});

export const updateRecurringSchema = createRecurringSchema.partial();

export const listRecurringSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(['ASC', 'DESC']).default('DESC'),
  search: z.string().optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  period: z.nativeEnum(RecurringPeriod).optional(),
  customerId: z.string().uuid().optional(),
});

export const fromInvoiceSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  period: z.nativeEnum(RecurringPeriod),
  nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoSubmit: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
export type ListRecurringQuery = z.infer<typeof listRecurringSchema>;
export type FromInvoiceInput = z.infer<typeof fromInvoiceSchema>;
