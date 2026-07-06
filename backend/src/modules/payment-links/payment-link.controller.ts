import { Router } from 'express';
import { paymentLinkService } from './payment-link.service';
import { createPaymentLinkSchema } from './payment-link.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';

export const paymentLinkRouter = Router();
paymentLinkRouter.use(requireAuth);

/**
 * @openapi
 * /payment-links:
 *   post:
 *     tags: [Payment Links]
 *     summary: Generate a hosted payment link for an invoice
 *     security: [{ bearerAuth: [] }]
 */
paymentLinkRouter.post(
  '/',
  validate(createPaymentLinkSchema),
  asyncHandler(async (req, res) => {
    const data = await paymentLinkService.create(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

paymentLinkRouter.get(
  '/by-invoice/:invoiceId',
  asyncHandler(async (req, res) => {
    const data = await paymentLinkService.listByInvoice(
      req.user!.companyId,
      req.params.invoiceId,
    );
    res.json({ success: true, data });
  }),
);

paymentLinkRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const data = await paymentLinkService.cancel(
      req.user!.companyId,
      req.params.id,
    );
    res.json({ success: true, data });
  }),
);
