import { Router } from 'express';
import { paymentService } from './payment.service';
import { createPaymentSchema, listPaymentSchema } from './payment.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';

export const paymentRouter = Router();
paymentRouter.use(requireAuth);

/**
 * @openapi
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: List recorded payments with filters
 *     security: [{ bearerAuth: [] }]
 */
paymentRouter.get(
  '/',
  validate(listPaymentSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await paymentService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

paymentRouter.get(
  '/summary',
  validate(listPaymentSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await paymentService.summary(req.user!.companyId, req.query as any);
    res.json({ success: true, data });
  }),
);

paymentRouter.post(
  '/',
  validate(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const data = await paymentService.create(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

paymentRouter.get(
  '/by-invoice/:invoiceId',
  asyncHandler(async (req, res) => {
    const data = await paymentService.listByInvoice(
      req.user!.companyId,
      req.params.invoiceId,
    );
    res.json({ success: true, data });
  }),
);
