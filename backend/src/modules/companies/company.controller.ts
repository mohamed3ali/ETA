import { Router } from 'express';
import { companyService } from './company.service';
import {
  createCompanySchema,
  updateCompanySchema,
  updateEtaCredentialsSchema,
} from './company.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../users/user.entity';

export const companyRouter = Router();
companyRouter.use(requireAuth);

companyRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const data = await companyService.getMine(req.user!.companyId);
    const { etaClientSecret, ...safe } = data as any;
    res.json({ success: true, data: safe });
  }),
);

/**
 * @openapi
 * /companies/mine:
 *   get:
 *     tags: [Companies]
 *     summary: List all companies the current user has access to
 *     security: [{ bearerAuth: [] }]
 */
companyRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const data = await companyService.listForUser(req.user!.sub);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /companies:
 *   post:
 *     tags: [Companies]
 *     summary: Create a new company under the current user (firm flow)
 *     security: [{ bearerAuth: [] }]
 */
companyRouter.post(
  '/',
  validate(createCompanySchema),
  asyncHandler(async (req, res) => {
    const data = await companyService.createForUser(req.user!.sub, req.body);
    res.status(201).json({ success: true, data });
  }),
);

companyRouter.patch(
  '/me',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  validate(updateCompanySchema),
  asyncHandler(async (req, res) => {
    const data = await companyService.updateMine(req.user!.companyId, req.body);
    res.json({ success: true, data });
  }),
);

companyRouter.put(
  '/me/eta-credentials',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  validate(updateEtaCredentialsSchema),
  asyncHandler(async (req, res) => {
    await companyService.updateEtaCredentials(req.user!.companyId, req.body);
    res.json({ success: true, data: { updated: true } });
  }),
);
