import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { etaPortalService } from './eta-portal.service';
import { paginationSchema } from '../../common/utils/pagination';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const syncSchema = z.object({
  direction: z.enum(['Sent', 'Received']).default('Sent'),
  issueDateFrom: dateOnly,
  issueDateTo: dateOnly,
  pageSize: z.coerce.number().int().min(10).max(100).optional(),
  maxPages: z.coerce.number().int().min(1).max(50).optional(),
});

const listSchema = paginationSchema.extend({
  direction: z.enum(['Sent', 'Received']).optional(),
  status: z.enum(['Valid', 'Invalid', 'Rejected', 'Cancelled', 'Submitted']).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const etaPortalRouter = Router();
etaPortalRouter.use(requireAuth);

/**
 * @openapi
 * /eta-portal/sync:
 *   post:
 *     tags: [ETA Portal]
 *     summary: Pull documents from the ETA portal for a date range
 *     security: [{ bearerAuth: [] }]
 */
etaPortalRouter.post(
  '/sync',
  validate(syncSchema),
  asyncHandler(async (req, res) => {
    const result = await etaPortalService.sync(req.user!.companyId, req.body);
    res.json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /eta-portal/documents:
 *   get:
 *     tags: [ETA Portal]
 *     summary: List documents synced from the ETA portal
 *     security: [{ bearerAuth: [] }]
 */
etaPortalRouter.get(
  '/documents',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await etaPortalService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

/**
 * @openapi
 * /eta-portal/documents/{uuid}:
 *   get:
 *     tags: [ETA Portal]
 *     summary: Get one document by UUID
 *     security: [{ bearerAuth: [] }]
 */
etaPortalRouter.get(
  '/documents/:uuid',
  asyncHandler(async (req, res) => {
    const data = await etaPortalService.getOne(req.user!.companyId, req.params.uuid);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /eta-portal/summary:
 *   get:
 *     tags: [ETA Portal]
 *     summary: Aggregate counts/totals for a date range, grouped by direction + status
 *     security: [{ bearerAuth: [] }]
 */
etaPortalRouter.get(
  '/summary',
  validate(
    z.object({ from: dateOnly, to: dateOnly }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as { from: string; to: string };
    const data = await etaPortalService.summary(req.user!.companyId, from, to);
    res.json({ success: true, data });
  }),
);
