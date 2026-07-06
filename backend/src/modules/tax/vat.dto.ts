import { z } from 'zod';
import { TaxFilingStatus } from './tax.utils';

export const vatPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

export const createVatPurchaseSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  supplierName: z.string().min(1).max(255),
  supplierTaxId: z.string().max(32).optional(),
  invoiceNumber: z.string().max(64).optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  netAmount: z.coerce.number().nonnegative(),
  vatAmount: z.coerce.number().nonnegative(),
  grossAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateVatPurchaseSchema = createVatPurchaseSchema
  .omit({ month: true, year: true })
  .partial();

export const markVatFiledSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const vatExportSchema = vatPeriodSchema.extend({
  format: z.enum(['excel', 'pdf']).default('excel'),
});

export const updateVatStatusSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  status: z.enum([
    TaxFilingStatus.DRAFT,
    TaxFilingStatus.READY_TO_FILE,
    TaxFilingStatus.FILED,
  ]),
});
