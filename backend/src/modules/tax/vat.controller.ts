import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { vatService } from './vat.service';
import {
  vatPeriodSchema,
  createVatPurchaseSchema,
  updateVatPurchaseSchema,
  markVatFiledSchema,
  vatExportSchema,
  updateVatStatusSchema,
} from './vat.dto';
import { vatExcelService } from './vat-excel.service';
import { vatPdfService } from './vat-pdf.service';

export const vatReturnRouter = Router();
vatReturnRouter.use(requireAuth);

vatReturnRouter.get(
  '/',
  validate(vatPeriodSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { year, month } = req.query as unknown as { year: number; month: number };
    const data = await vatService.getReturn(req.user!.companyId, year, month);
    res.json({ success: true, data });
  }),
);

vatReturnRouter.post(
  '/purchase',
  validate(createVatPurchaseSchema),
  asyncHandler(async (req, res) => {
    const data = await vatService.createPurchase(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

vatReturnRouter.put(
  '/purchase/:id',
  validate(updateVatPurchaseSchema),
  asyncHandler(async (req, res) => {
    const data = await vatService.updatePurchase(req.user!.companyId, req.params.id, req.body);
    res.json({ success: true, data });
  }),
);

vatReturnRouter.delete(
  '/purchase/:id',
  asyncHandler(async (req, res) => {
    const data = await vatService.deletePurchase(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

vatReturnRouter.post(
  '/mark-filed',
  validate(markVatFiledSchema),
  asyncHandler(async (req, res) => {
    const { year, month } = req.body;
    const data = await vatService.markFiled(req.user!.companyId, year, month);
    res.json({ success: true, data });
  }),
);

vatReturnRouter.patch(
  '/status',
  validate(updateVatStatusSchema),
  asyncHandler(async (req, res) => {
    const { year, month, status } = req.body;
    const data = await vatService.updateStatus(req.user!.companyId, year, month, status);
    res.json({ success: true, data });
  }),
);

vatReturnRouter.get(
  '/export',
  validate(vatExportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { year, month, format } = req.query as unknown as {
      year: number;
      month: number;
      format: 'excel' | 'pdf';
    };
    const companyId = req.user!.companyId;
    if (format === 'pdf') {
      const buf = await vatPdfService.render(companyId, year, month);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vat-return-${year}-${month}.pdf"`,
      );
      return res.send(buf);
    }
    const buf = await vatExcelService.exportReturn(companyId, year, month);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vat-return-${year}-${month}.xlsx"`,
    );
    res.send(buf);
  }),
);
