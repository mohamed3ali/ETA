import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { form41Service } from './form41.service';
import {
  form41PeriodSchema,
  createWithholdingEntrySchema,
  updateWithholdingEntrySchema,
  markForm41FiledSchema,
  form41ExportSchema,
  updateForm41StatusSchema,
} from './form41.dto';
import { form41ExcelService } from './form41-excel.service';
import { form41PdfService } from './form41-pdf.service';

export const form41Router = Router();
form41Router.use(requireAuth);

form41Router.get(
  '/',
  validate(form41PeriodSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { year, quarter } = req.query as unknown as { year: number; quarter: string };
    const data = await form41Service.getForm(req.user!.companyId, year, quarter);
    res.json({ success: true, data });
  }),
);

form41Router.post(
  '/entry',
  validate(createWithholdingEntrySchema),
  asyncHandler(async (req, res) => {
    const data = await form41Service.createEntry(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

form41Router.put(
  '/entry/:id',
  validate(updateWithholdingEntrySchema),
  asyncHandler(async (req, res) => {
    const data = await form41Service.updateEntry(req.user!.companyId, req.params.id, req.body);
    res.json({ success: true, data });
  }),
);

form41Router.delete(
  '/entry/:id',
  asyncHandler(async (req, res) => {
    const data = await form41Service.deleteEntry(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

form41Router.post(
  '/mark-filed',
  validate(markForm41FiledSchema),
  asyncHandler(async (req, res) => {
    const { year, quarter } = req.body;
    const data = await form41Service.markFiled(req.user!.companyId, year, quarter);
    res.json({ success: true, data });
  }),
);

form41Router.patch(
  '/status',
  validate(updateForm41StatusSchema),
  asyncHandler(async (req, res) => {
    const { year, quarter, status } = req.body;
    const data = await form41Service.updateStatus(req.user!.companyId, year, quarter, status);
    res.json({ success: true, data });
  }),
);

form41Router.get(
  '/export',
  validate(form41ExportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { year, quarter, format } = req.query as unknown as {
      year: number;
      quarter: string;
      format: 'excel' | 'pdf';
    };
    const companyId = req.user!.companyId;
    if (format === 'pdf') {
      const buf = await form41PdfService.render(companyId, year, quarter);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="form41-${quarter}-${year}.pdf"`,
      );
      return res.send(buf);
    }
    const buf = await form41ExcelService.exportForm(companyId, year, quarter);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="form41-${quarter}-${year}.xlsx"`,
    );
    res.send(buf);
  }),
);
