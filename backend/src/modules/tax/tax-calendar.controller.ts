import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { taxCalendarService } from './tax-calendar.service';

export const taxCalendarRouter = Router();
taxCalendarRouter.use(requireAuth);

taxCalendarRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await taxCalendarService.list(req.user!.companyId);
    res.json({ success: true, data });
  }),
);
