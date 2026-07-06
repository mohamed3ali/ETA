import { Router } from 'express';
import { invoiceService } from './invoice.service';
import {
  changeStatusSchema,
  createInvoiceSchema,
  listInvoiceSchema,
  submitSignedSchema,
  updateInvoiceSchema,
} from './invoice.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { invoicePdfService } from './invoice-pdf.service';
import { invoiceExcelService } from './invoice-excel.service';
import { enqueueInvoiceSubmission } from '../../queues/invoice.queue';
import { InvoiceStatus } from './invoice.entity';
import { HttpError } from '../../common/errors/HttpError';
import { requireActiveSubscription } from '../subscriptions/subscription.middleware';
import { etaService } from '../eta/eta.service';

export const invoiceRouter = Router();
invoiceRouter.use(requireAuth);

/**
 * @openapi
 * /invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List invoices with filters
 *     security: [{ bearerAuth: [] }]
 */
invoiceRouter.get(
  '/',
  validate(listInvoiceSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.list(req.user!.companyId, req.query as any);
    res.json({ success: true, ...data });
  }),
);

invoiceRouter.get(
  '/export/excel',
  validate(listInvoiceSchema, 'query'),
  asyncHandler(async (req, res) => {
    const buf = await invoiceExcelService.exportFiltered(
      req.user!.companyId,
      req.query as any,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${Date.now()}.xlsx"`);
    res.send(buf);
  }),
);

invoiceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await invoiceService.getById(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);

invoiceRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getById(req.user!.companyId, req.params.id);
    const buf = await invoicePdfService.render(req.user!.companyId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    );
    res.send(buf);
  }),
);

/**
 * @openapi
 * /invoices:
 *   post:
 *     tags: [Invoices]
 *     summary: Create a new invoice (draft)
 *     security: [{ bearerAuth: [] }]
 */
invoiceRouter.post(
  '/',
  requireActiveSubscription,
  validate(createInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.create(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

invoiceRouter.patch(
  '/:id',
  validate(updateInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.update(
      req.user!.companyId,
      req.user!.sub,
      req.params.id,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

invoiceRouter.post(
  '/:id/status',
  validate(changeStatusSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.changeStatus(
      req.user!.companyId,
      req.user!.sub,
      req.params.id,
      req.body.status,
    );
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /invoices/{id}/submit:
 *   post:
 *     tags: [Invoices]
 *     summary: Submit invoice to ETA (queued)
 *     security: [{ bearerAuth: [] }]
 */
invoiceRouter.post(
  '/:id/submit',
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const inv = await invoiceService.getById(req.user!.companyId, req.params.id);
    if (inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.REJECTED) {
      throw HttpError.badRequest('Only draft or rejected invoices can be submitted');
    }
    await invoiceService.changeStatus(
      req.user!.companyId,
      req.user!.sub,
      inv.id,
      InvoiceStatus.SUBMITTED,
    );
    await enqueueInvoiceSubmission({ invoiceId: inv.id, companyId: inv.companyId });
    res.json({ success: true, data: { queued: true, invoiceId: inv.id } });
  }),
);

/**
 * @openapi
 * /invoices/{id}/eta-payload:
 *   get:
 *     tags: [Invoices]
 *     summary: Build the unsigned ETA document for an invoice (for the Desktop Agent to sign)
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Returns the document JSON, its ETA canonical form, and the SHA-256 hash
 *       to be signed. The Desktop Agent feeds the canonical form to its own
 *       hasher to verify a match before producing the CAdES-BES signature.
 */
invoiceRouter.get(
  '/:id/eta-payload',
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const data = await etaService.buildSignablePayload(
      req.user!.companyId,
      req.params.id,
    );
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /invoices/{id}/submit-signed:
 *   post:
 *     tags: [Invoices]
 *     summary: Submit a signed invoice to ETA (synchronous)
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Forwards the document — with signatures produced by the Desktop Agent —
 *       to ETA in a single round trip and returns the accepted/rejected outcome.
 *       Use this in place of the queued `/submit` endpoint whenever the
 *       company has an eSeal token connected.
 */
invoiceRouter.post(
  '/:id/submit-signed',
  requireActiveSubscription,
  validate(submitSignedSchema),
  asyncHandler(async (req, res) => {
    const inv = await invoiceService.getById(req.user!.companyId, req.params.id);
    if (
      inv.status !== InvoiceStatus.DRAFT &&
      inv.status !== InvoiceStatus.REJECTED &&
      inv.status !== InvoiceStatus.SUBMITTED
    ) {
      throw HttpError.badRequest(
        'Only draft, submitted, or rejected invoices can be submitted',
      );
    }
    if (inv.status === InvoiceStatus.DRAFT) {
      await invoiceService.changeStatus(
        req.user!.companyId,
        req.user!.sub,
        inv.id,
        InvoiceStatus.SUBMITTED,
      );
    }
    const outcome = await etaService.submitInvoice(
      inv.id,
      inv.companyId,
      req.body.signatures,
    );
    res.json({ success: outcome.success, data: outcome });
  }),
);

invoiceRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await invoiceService.remove(req.user!.companyId, req.params.id);
    res.json({ success: true, data });
  }),
);
