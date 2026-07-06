import { Router } from 'express';
import { customerService } from './customer.service';
import { createCustomerSchema, updateCustomerSchema } from './customer.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { paginationSchema } from '../../common/utils/pagination';

export const customerRouter = Router();

customerRouter.use(requireAuth);

/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 */
customerRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await customerService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

customerRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await customerService.getById(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a customer
 *     security: [{ bearerAuth: [] }]
 */
customerRouter.post(
  '/',
  validate(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const data = await customerService.create(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

customerRouter.patch(
  '/:id',
  validate(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const data = await customerService.update(req.user!.companyId, req.params.id, req.body);
    res.json({ success: true, data });
  }),
);

customerRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await customerService.remove(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);
