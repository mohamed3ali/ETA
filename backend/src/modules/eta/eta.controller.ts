import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { etaService } from './eta.service';
import { AppDataSource } from '../../database/data-source';
import { EtaSyncLog } from './eta-sync-log.entity';
import { enqueueInvoiceSubmission } from '../../queues/invoice.queue';
import { UserRole } from '../users/user.entity';

export const etaRouter = Router();
etaRouter.use(requireAuth);

/**
 * @openapi
 * /eta/status/{uuid}:
 *   get:
 *     tags: [ETA]
 *     summary: Fetch live status of an invoice from ETA
 *     security: [{ bearerAuth: [] }]
 */
etaRouter.get(
  '/status/:uuid',
  asyncHandler(async (req, res) => {
    const data = await etaService.fetchInvoiceStatus(req.user!.companyId, req.params.uuid);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /eta/logs:
 *   get:
 *     tags: [ETA]
 *     summary: ETA sync logs for the current company
 *     security: [{ bearerAuth: [] }]
 */
etaRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const logs = await AppDataSource.getRepository(EtaSyncLog).find({
      where: { companyId: req.user!.companyId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    res.json({ success: true, data: logs });
  }),
);

/**
 * @openapi
 * /eta/retry/{invoiceId}:
 *   post:
 *     tags: [ETA]
 *     summary: Manually requeue a rejected invoice
 *     security: [{ bearerAuth: [] }]
 */
etaRouter.post(
  '/retry/:invoiceId',
  requireRoles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT),
  asyncHandler(async (req, res) => {
    await enqueueInvoiceSubmission({
      invoiceId: req.params.invoiceId,
      companyId: req.user!.companyId,
    });
    res.json({ success: true, data: { queued: true } });
  }),
);
