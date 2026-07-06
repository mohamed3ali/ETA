import { z } from 'zod';
import { ProductKind } from './product.entity';

export const createProductSchema = z.object({
  kind: z.nativeEnum(ProductKind).default(ProductKind.PRODUCT),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  etaItemCode: z.string().max(100).optional(),
  etaCodeType: z.enum(['GS1', 'EGS']).default('GS1'),
  unitType: z.string().max(20).default('EA'),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(14),
  currency: z.string().length(3).default('EGP'),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listProductSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().max(120).optional(),
  kind: z.nativeEnum(ProductKind).optional(),
  active: z.coerce.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductInput = z.infer<typeof listProductSchema>;
