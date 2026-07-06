import { Router } from 'express';
import { z } from 'zod';
import { alertService } from './alert.service';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';

export const alertRouter = Router();
alertRouter.use(requireAuth);

const listQuerySchema = z.object({
  onlyUnread: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * @openapi
 * /alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: List in-app alerts for the current tenant
 *     security: [{ bearerAuth: [] }]
 */
alertRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as { onlyUnread?: boolean; limit?: number };
    const data = await alertService.list(req.user!.companyId, q);
    res.json({ success: true, data });
  }),
);

alertRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await alertService.unreadCount(req.user!.companyId);
    res.json({ success: true, data: { count } });
  }),
);

alertRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const data = await alertService.markRead(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

alertRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const data = await alertService.markAllRead(req.user!.companyId);
    res.json({ success: true, data });
  }),
);

alertRouter.post(
  '/:id/dismiss',
  asyncHandler(async (req, res) => {
    const data = await alertService.dismiss(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

/**
 * Manual rule re-evaluation. Owners can hit this to refresh alerts without
 * waiting for the daily cron — useful right after onboarding.
 */
alertRouter.post(
  '/evaluate',
  asyncHandler(async (req, res) => {
    const touched = await alertService.evaluateForCompany(req.user!.companyId);
    res.json({ success: true, data: { touched: touched.length } });
  }),
);
