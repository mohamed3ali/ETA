import { z } from 'zod';
import { InvoiceStatus, InvoiceType } from './invoice.entity';

export const invoiceItemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1).max(255),
  etaItemCode: z.string().max(100).optional(),
  etaCodeType: z.enum(['GS1', 'EGS']).default('GS1'),
  unitType: z.string().max(20).default('EA'),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(14),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  type: z.nativeEnum(InvoiceType).default(InvoiceType.INVOICE),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  currency: z.string().length(3).default('EGP'),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1).max(200),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const listInvoiceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(['ASC', 'DESC']).default('DESC'),
  search: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  type: z.nativeEnum(InvoiceType).optional(),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

/**
 * Body of `POST /invoices/:id/submit-signed`. The Desktop Agent produces
 * one signature per certificate (typically just the Issuer / `I`) and
 * forwards it back here to be attached to the document.
 */
export const submitSignedSchema = z.object({
  signatures: z
    .array(
      z.object({
        signatureType: z.enum(['I', 'S']),
        value: z.string().min(1).max(64_000),
      }),
    )
    .min(1)
    .max(2),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoiceQuery = z.infer<typeof listInvoiceSchema>;
export type SubmitSignedInput = z.infer<typeof submitSignedSchema>;
