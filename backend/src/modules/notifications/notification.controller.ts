import { Router } from 'express';
import { z } from 'zod';
import { notificationService } from './notification.service';
import {
  sendInvoiceMessageSchema,
  updateSettingsSchema,
} from './notification.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../users/user.entity';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

/**
 * @openapi
 * /notifications/settings:
 *   get:
 *     tags: [Notifications]
 *     summary: Get per-company notification preferences
 *     security: [{ bearerAuth: [] }]
 */
notificationRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const data = await notificationService.getSettings(req.user!.companyId);
    res.json({ success: true, data });
  }),
);

notificationRouter.patch(
  '/settings',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const data = await notificationService.updateSettings(
      req.user!.companyId,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /notifications/whatsapp/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Manually send a WhatsApp message for an invoice
 *     security: [{ bearerAuth: [] }]
 */
notificationRouter.post(
  '/whatsapp/send',
  validate(sendInvoiceMessageSchema),
  asyncHandler(async (req, res) => {
    const data = await notificationService.queueInvoiceMessage({
      companyId: req.user!.companyId,
      invoiceId: req.body.invoiceId,
      template: req.body.template,
      extraVars: req.body.variables,
    });
    res.json({ success: true, data });
  }),
);

const listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() });

notificationRouter.get(
  '/whatsapp',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await notificationService.listMessages(
      req.user!.companyId,
      Number((req.query as any).limit) || 50,
    );
    res.json({ success: true, data });
  }),
);

notificationRouter.get(
  '/whatsapp/by-invoice/:invoiceId',
  asyncHandler(async (req, res) => {
    const data = await notificationService.listMessagesByInvoice(
      req.user!.companyId,
      req.params.invoiceId,
    );
    res.json({ success: true, data });
  }),
);
