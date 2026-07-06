import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate';
import { requireAuth } from '../auth/auth.middleware';
import { subscriptionService } from './subscription.service';
import { quotaService } from './quota.service';
import { startCheckoutSchema } from './subscription.dto';
import { PLAN_CATALOG } from './plans';
import { SubscriptionPlan } from './subscription.entity';

export const subscriptionRouter = Router();

/**
 * Public plan catalog — exposed without auth so the marketing site can
 * pull canonical pricing if it wants to. The router-level requireAuth
 * below is applied to the other routes.
 */
subscriptionRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: subscriptionService.catalog() });
  }),
);

subscriptionRouter.use(requireAuth);

/**
 * Current company's active subscription enriched with quota usage and the
 * matching plan catalog entry. The frontend Settings page renders this
 * directly — see `frontend/src/app/(dashboard)/settings/page.tsx`.
 */
subscriptionRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const sub = await subscriptionService.getActive(req.user!.companyId);
    const usage = await quotaService.getUsage(req.user!.companyId);
    const catalogEntry =
      sub && sub.plan !== SubscriptionPlan.TRIAL
        ? PLAN_CATALOG[sub.plan as Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>]
        : null;
    res.json({
      success: true,
      data: {
        subscription: sub,
        usage,
        catalog: catalogEntry,
      },
    });
  }),
);

/**
 * Lightweight quota-only endpoint, suitable for polling from UI badges.
 */
subscriptionRouter.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const usage = await quotaService.getUsage(req.user!.companyId);
    res.json({ success: true, data: usage });
  }),
);

/**
 * Start a new checkout session. The frontend immediately redirects the
 * user to the returned `checkoutUrl` (Paymob hosted page in production
 * mode, or our own `/checkout/complete?token=...` page in mock mode).
 */
subscriptionRouter.post(
  '/checkout',
  validate(startCheckoutSchema),
  asyncHandler(async (req, res) => {
    const checkout = await subscriptionService.startCheckout(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({
      success: true,
      data: {
        token: checkout.token,
        checkoutUrl: checkout.checkoutUrl,
        provider: checkout.provider,
        amount: Number(checkout.amount),
        currency: checkout.currency,
      },
    });
  }),
);

subscriptionRouter.post(
  '/checkout/:id/cancel',
  asyncHandler(async (req, res) => {
    const co = await subscriptionService.cancelCheckout(req.user!.companyId, req.params.id);
    res.json({ success: true, data: co });
  }),
);
