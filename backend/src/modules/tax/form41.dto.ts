import { z } from 'zod';
import { TaxFilingStatus } from './tax.utils';

const quarterSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4']);

export const form41PeriodSchema = z.object({
  quarter: quarterSchema,
  year: z.coerce.number().int().min(2020).max(2100),
});

export const createWithholdingEntrySchema = z.object({
  quarter: quarterSchema,
  year: z.number().int().min(2020).max(2100),
  payeeName: z.string().min(1).max(255),
  payeeId: z.string().max(32).optional(),
  paymentType: z.string().min(1).max(64),
  grossAmount: z.coerce.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateWithholdingEntrySchema = createWithholdingEntrySchema
  .omit({ quarter: true, year: true })
  .partial();

export const markForm41FiledSchema = form41PeriodSchema;

export const form41ExportSchema = form41PeriodSchema.extend({
  format: z.enum(['excel', 'pdf']).default('excel'),
});

export const updateForm41StatusSchema = form41PeriodSchema.extend({
  status: z.enum([
    TaxFilingStatus.DRAFT,
    TaxFilingStatus.READY_TO_FILE,
    TaxFilingStatus.FILED,
  ]),
});
