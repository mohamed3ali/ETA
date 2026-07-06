import { Router } from 'express';
import { z } from 'zod';

import { recurringInvoiceService } from './recurring-invoice.service';
import {
  createRecurringSchema,
  fromInvoiceSchema,
  listRecurringSchema,
  updateRecurringSchema,
} from './recurring-invoice.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscriptions/subscription.middleware';

export const recurringInvoiceRouter = Router();
recurringInvoiceRouter.use(requireAuth);

const toggleActiveSchema = z.object({ isActive: z.coerce.boolean() });

/**
 * @openapi
 * /recurring-invoices:
 *   get:
 *     tags: [Recurring Invoices]
 *     summary: List recurring invoice templates
 *     security: [{ bearerAuth: [] }]
 */
recurringInvoiceRouter.get(
  '/',
  validate(listRecurringSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

recurringInvoiceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.getById(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /recurring-invoices:
 *   post:
 *     tags: [Recurring Invoices]
 *     summary: Create a new recurring invoice template
 *     security: [{ bearerAuth: [] }]
 */
recurringInvoiceRouter.post(
  '/',
  requireActiveSubscription,
  validate(createRecurringSchema),
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.create(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

/**
 * @openapi
 * /recurring-invoices/from-invoice/{invoiceId}:
 *   post:
 *     tags: [Recurring Invoices]
 *     summary: Promote an existing invoice into a recurring template
 *     security: [{ bearerAuth: [] }]
 */
recurringInvoiceRouter.post(
  '/from-invoice/:invoiceId',
  requireActiveSubscription,
  validate(fromInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.createFromInvoice(
      req.user!.companyId,
      req.user!.sub,
      req.params.invoiceId,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

recurringInvoiceRouter.patch(
  '/:id',
  validate(updateRecurringSchema),
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.update(
      req.user!.companyId,
      req.params.id,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

recurringInvoiceRouter.post(
  '/:id/active',
  validate(toggleActiveSchema),
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.toggleActive(
      req.user!.companyId,
      req.params.id,
      req.body.isActive,
    );
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /recurring-invoices/{id}/run:
 *   post:
 *     tags: [Recurring Invoices]
 *     summary: Generate the next invoice for this template immediately
 *     security: [{ bearerAuth: [] }]
 */
recurringInvoiceRouter.post(
  '/:id/run',
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    // Ensure scoping: must belong to the user's company
    await recurringInvoiceService.getById(req.user!.companyId, req.params.id);
    const result = await recurringInvoiceService.runOne(req.params.id);
    res.json({ success: true, data: result });
  }),
);

recurringInvoiceRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await recurringInvoiceService.remove(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);
