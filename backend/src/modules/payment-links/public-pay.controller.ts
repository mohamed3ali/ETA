import { Router } from 'express';
import { paymentLinkService } from './payment-link.service';
import { paymobAdapter } from './paymob.adapter';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { logger } from '../../config/logger';

/**
 * Public, **unauthenticated** payment endpoints. Mounted at `/api/public/pay`
 * so that customers can view + confirm a payment without an account.
 *
 * Security model:
 *   - All access is gated by the random 32-char token in the URL.
 *   - The mock-confirm endpoint is only useful when the link's provider is
 *     `MOCK` (i.e. no real gateway configured); for real providers, the
 *     webhook is the only path that can flip a link to PAID.
 */
export const publicPayRouter = Router();

publicPayRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const data = await paymentLinkService.getPublicByToken(req.params.token);
    res.json({ success: true, data });
  }),
);

/**
 * Mock-mode confirmation. Lets the platform run end-to-end without a real
 * payment gateway — clicking "Confirm payment" on the public page hits this
 * endpoint and immediately marks the link paid.
 */
publicPayRouter.post(
  '/:token/confirm-mock',
  asyncHandler(async (req, res) => {
    const link = await paymentLinkService.getByToken(req.params.token);
    if (!link) {
      res.status(404).json({ success: false, error: { message: 'Not found' } });
      return;
    }
    if (link.provider !== 'mock') {
      res
        .status(400)
        .json({ success: false, error: { message: 'This link uses a real payment gateway' } });
      return;
    }
    await paymentLinkService.markPaid(req.params.token, { mock: true });
    res.json({ success: true, data: { paid: true } });
  }),
);

/**
 * Paymob (and other gateway) webhook. Verifies the HMAC signature, then
 * marks the link paid on `txn_response_code` success.
 */
publicPayRouter.post(
  '/:token/webhook',
  asyncHandler(async (req, res) => {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const hmac =
      ((req.query.hmac ?? req.headers['x-paymob-signature'] ?? req.headers['hmac']) as
        | string
        | undefined) || undefined;

    if (!paymobAdapter.verifyWebhook(payload, hmac)) {
      logger.warn({ token: req.params.token }, 'Rejected payment webhook: bad signature');
      res.status(401).json({ success: false });
      return;
    }

    // Paymob success indicator — covers both modern intention and legacy callbacks.
    const obj = (payload.obj ?? payload) as Record<string, unknown>;
    const success = obj.success === true || obj.success === 'true';
    const providerRef = String(obj.id ?? obj.intention_order_id ?? '') || undefined;

    if (success) {
      await paymentLinkService.markPaid(req.params.token, { providerRef });
    } else {
      logger.info(
        { token: req.params.token, providerRef },
        'Webhook received with non-success status — ignoring',
      );
    }
    res.json({ success: true });
  }),
);
