import { Router } from 'express';
import { branchService } from './branch.service';
import { createBranchSchema, updateBranchSchema } from './branch.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../users/user.entity';

export const branchRouter = Router();
branchRouter.use(requireAuth);

branchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await branchService.list(req.user!.companyId);
    res.json({ success: true, data });
  }),
);

branchRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await branchService.getById(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

branchRouter.post(
  '/',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  validate(createBranchSchema),
  asyncHandler(async (req, res) => {
    const data = await branchService.create(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

branchRouter.patch(
  '/:id',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  validate(updateBranchSchema),
  asyncHandler(async (req, res) => {
    const data = await branchService.update(req.user!.companyId, req.params.id, req.body);
    res.json({ success: true, data });
  }),
);

branchRouter.delete(
  '/:id',
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const data = await branchService.remove(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);
