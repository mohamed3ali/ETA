import { Router } from 'express';
import { dashboardService } from './dashboard.service';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getMetrics(req.user!.companyId);
    res.json({ success: true, data });
  }),
);

dashboardRouter.get(
  '/revenue-by-month',
  asyncHandler(async (req, res) => {
    const months = Math.min(36, Math.max(1, Number(req.query.months) || 12));
    const data = await dashboardService.getRevenueByMonth(req.user!.companyId, months);
    res.json({ success: true, data });
  }),
);

dashboardRouter.get(
  '/top-customers',
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 5));
    const data = await dashboardService.getTopCustomers(req.user!.companyId, limit);
    res.json({ success: true, data });
  }),
);

dashboardRouter.get(
  '/recent-invoices',
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const data = await dashboardService.getRecentInvoices(req.user!.companyId, limit);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /dashboard/firm-overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: KPIs rolled up across all companies the user has access to
 *     security: [{ bearerAuth: [] }]
 */
dashboardRouter.get(
  '/firm-overview',
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getFirmOverview(req.user!.sub);
    res.json({ success: true, data });
  }),
);
