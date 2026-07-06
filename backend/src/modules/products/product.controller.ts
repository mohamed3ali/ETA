import { Router } from 'express';
import { z } from 'zod';
import { productService } from './product.service';
import {
  createProductSchema,
  updateProductSchema,
} from './product.dto';
import { ProductKind } from './product.entity';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { paginationSchema } from '../../common/utils/pagination';

const listQuerySchema = paginationSchema.extend({
  kind: z.nativeEnum(ProductKind).optional(),
  active: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

export const productRouter = Router();
productRouter.use(requireAuth);

productRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await productService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

productRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await productService.getById(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

productRouter.post(
  '/',
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const data = await productService.create(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

productRouter.patch(
  '/:id',
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const data = await productService.update(req.user!.companyId, req.params.id, req.body);
    res.json({ success: true, data });
  }),
);

productRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await productService.remove(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);
