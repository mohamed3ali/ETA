import { Router } from 'express';

import { asyncHandler } from '../../common/utils/asyncHandler';
import { logger } from '../../config/logger';
import { paymobAdapter } from '../payment-links/paymob.adapter';
import { subscriptionService } from './subscription.service';
import { SubscriptionCheckoutProvider } from './subscription-checkout.entity';

/**
 * Public (unauthenticated) subscription endpoints. Customers land here
 * after returning from Paymob (or after clicking the mock "Confirm
 * payment" button) so we can show order status and finalize activation.
 *
 * Security model:
 *   - All access gated by the 32-char random token in the URL.
 *   - Mock-confirm only succeeds for sessions whose provider is `MOCK`.
 *   - Webhook verifies the HMAC signature.
 */
export const publicSubscriptionRouter = Router();

publicSubscriptionRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const data = await subscriptionService.getCheckoutPublic(req.params.token);
    res.json({ success: true, data });
  }),
);

/**
 * Mock confirmation — lets the platform run end-to-end without real
 * Paymob credentials. Only usable when the session's provider is `MOCK`.
 */
publicSubscriptionRouter.post(
  '/:token/confirm-mock',
  asyncHandler(async (req, res) => {
    const co = await subscriptionService.getCheckoutByToken(req.params.token);
    if (!co) {
      res.status(404).json({ success: false, error: { message: 'Not found' } });
      return;
    }
    if (co.provider !== SubscriptionCheckoutProvider.MOCK) {
      res
        .status(400)
        .json({ success: false, error: { message: 'This session uses a real payment gateway' } });
      return;
    }
    await subscriptionService.markCheckoutPaid(req.params.token, { mock: true });
    res.json({ success: true, data: { paid: true } });
  }),
);

/**
 * Paymob webhook — flips the checkout to PAID and activates the subscription
 * on `success`. Verifies the HMAC signature using the shared adapter.
 */
publicSubscriptionRouter.post(
  '/:token/webhook',
  asyncHandler(async (req, res) => {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const hmac = (req.headers['x-paymob-signature'] ?? req.headers['hmac']) as
      | string
      | undefined;

    if (!paymobAdapter.verifyWebhook(payload, hmac)) {
      logger.warn(
        { token: req.params.token },
        'Rejected subscription payment webhook: bad signature',
      );
      res.status(401).json({ success: false });
      return;
    }

    const obj = (payload.obj ?? payload) as Record<string, unknown>;
    const success = obj.success === true || obj.success === 'true';
    const providerRef = String(obj.id ?? obj.intention_order_id ?? '') || undefined;

    if (success) {
      await subscriptionService.markCheckoutPaid(req.params.token, { providerRef });
    } else {
      logger.info(
        { token: req.params.token, providerRef },
        'Subscription webhook received with non-success status — ignoring',
      );
    }
    res.json({ success: true });
  }),
);
