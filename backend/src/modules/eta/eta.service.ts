import { AppDataSource } from '../../database/data-source';
import { Company } from '../companies/company.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { InvoiceLog, InvoiceLogAction } from '../invoices/invoice-log.entity';
import { EtaSyncLog, EtaSyncDirection, EtaSyncStatus } from './eta-sync-log.entity';
import { etaTokenService } from './eta-token.service';
import { mapInvoiceToEta } from './eta-mapper';
import { canonicalizeEtaDocument, sha256Hex } from './eta-canonicalizer';
import { EtaDocument, EtaSignature, EtaSubmitResponse } from './eta.types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { HttpError } from '../../common/errors/HttpError';
import { notificationService } from '../notifications/notification.service';
import { NotificationSettings } from '../notifications/notification-settings.entity';
import { WhatsappTemplate } from '../notifications/whatsapp-message.entity';
import { alertService } from '../alerts/alert.service';
import { AlertSeverity, AlertType } from '../alerts/alert.entity';

const apiBaseUrl = (envName: 'preprod' | 'production') =>
  envName === 'production'
    ? 'https://api.invoicing.eta.gov.eg'
    : env.ETA_BASE_URL;

export interface SubmitOutcome {
  success: boolean;
  uuid?: string;
  longId?: string;
  submissionId?: string;
  errors?: unknown;
}

/**
 * Payload returned to the Desktop Agent. The agent must canonicalize the
 * `document` locally (excluding `signatures`) and verify it produces the same
 * `hashHex` before signing — that guards against a tampered or mismatched
 * payload.
 */
export interface EtaSignablePayload {
  document: EtaDocument;
  canonical: string;
  hashAlgorithm: 'SHA-256';
  hashHex: string;
  issuer: { rin: string; name: string };
}

export const etaService = {
  /**
   * Returns the raw ETA document JSON for an invoice, ready to be canonicalized
   * + hashed + signed by the Desktop Agent. The invoice must still be `draft`
   * or `rejected` (i.e. not yet accepted by ETA).
   *
   * The agent should canonicalize the `document` locally (excluding the
   * `signatures` field) and verify it produces the same `hashHex` returned
   * here before signing — this catches mismatches between the server's view
   * of the invoice and what's about to be signed.
   */
  async buildSignablePayload(
    companyId: string,
    invoiceId: string,
  ): Promise<EtaSignablePayload> {
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, companyId },
      relations: ['items', 'customer'],
    });
    if (!invoice) throw HttpError.notFound('Invoice not found');

    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.REJECTED &&
      invoice.status !== InvoiceStatus.SUBMITTED
    ) {
      throw HttpError.badRequest(
        'Only draft, submitted, or rejected invoices can be signed',
      );
    }

    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });

    const document = mapInvoiceToEta(
      invoice as Invoice & { items: Invoice['items']; customer: any },
      company,
    );

    const canonical = canonicalizeEtaDocument(
      document as unknown as Record<string, unknown>,
      { excludeKeys: ['signatures'] },
    );

    return {
      document,
      canonical,
      hashAlgorithm: 'SHA-256',
      hashHex: sha256Hex(canonical),
      issuer: { rin: company.taxRegistrationNumber, name: company.name },
    };
  },

  /**
   * Submit a single invoice to the ETA.
   * If credentials are not configured, this runs in **mock mode** and returns a synthetic UUID,
   * so the full flow (queue → status update → UI) is testable end-to-end.
   *
   * Pass `signatures` when the document has been signed by a Desktop Agent
   * (eSeal via USB Token / HSM). When `signatures` is omitted the document is
   * submitted unsigned — useful only for the in-house mock mode, where ETA
   * credentials are absent.
   */
  async submitInvoice(
    invoiceId: string,
    companyId: string,
    signatures?: EtaSignature[],
  ): Promise<SubmitOutcome> {
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, companyId },
      relations: ['items', 'customer'],
    });
    if (!invoice) throw HttpError.notFound('Invoice not found');

    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });

    const document = mapInvoiceToEta(
      invoice as Invoice & { items: Invoice['items']; customer: any },
      company,
    );
    if (signatures && signatures.length > 0) {
      document.signatures = signatures;
    }

    const syncLog = AppDataSource.getRepository(EtaSyncLog).create({
      companyId,
      invoiceId,
      direction: EtaSyncDirection.OUTBOUND,
      status: EtaSyncStatus.PENDING,
      action: 'submit',
      request: { documents: [document] },
    });
    await AppDataSource.getRepository(EtaSyncLog).save(syncLog);

    const useMock =
      !company.etaClientId || !company.etaClientSecret || env.ETA_CLIENT_ID === '';

    try {
      let response: EtaSubmitResponse;

      if (useMock) {
        logger.warn(
          { companyId, invoiceId },
          'ETA submission running in MOCK mode (no credentials)',
        );
        await new Promise((r) => setTimeout(r, 300));
        response = {
          submissionId: `MOCK-SUB-${Date.now()}`,
          acceptedDocuments: [
            {
              uuid: `MOCK-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`,
              longId: `MOCK-LONG-${Date.now()}`,
              internalId: invoice.invoiceNumber,
              hashKey: 'MOCK-HASH',
            },
          ],
        };
      } else {
        const token = await etaTokenService.getToken(companyId, {
          clientId: company.etaClientId!,
          clientSecret: company.etaClientSecret!,
          environment: company.etaEnvironment,
        });

        const res = await fetch(`${apiBaseUrl(company.etaEnvironment)}/api/v1/documentsubmissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documents: [document] }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`ETA submit failed: ${res.status} ${text}`);
        }
        response = (await res.json()) as EtaSubmitResponse;
      }

      const accepted = response.acceptedDocuments?.[0];
      const rejected = response.rejectedDocuments?.[0];

      if (accepted) {
        invoice.status = InvoiceStatus.ACCEPTED;
        invoice.etaUuid = accepted.uuid;
        invoice.etaLongId = accepted.longId;
        invoice.etaSubmissionId = response.submissionId;
        invoice.etaInternalId = accepted.internalId;
        invoice.etaSubmittedAt = new Date();
        invoice.etaErrors = undefined;
        await AppDataSource.getRepository(Invoice).save(invoice);

        const logRepo = AppDataSource.getRepository(InvoiceLog);
        await logRepo.save(
          logRepo.create({
            invoiceId,
            action: InvoiceLogAction.ETA_ACCEPTED,
            meta: { uuid: accepted.uuid, submissionId: response.submissionId },
          }),
        );

        syncLog.status = EtaSyncStatus.SUCCESS;
        syncLog.response = response as unknown as Record<string, unknown>;
        await AppDataSource.getRepository(EtaSyncLog).save(syncLog);

        // Auto-send WhatsApp "invoice_sent" if enabled.
        try {
          const settings = await AppDataSource.getRepository(NotificationSettings).findOne({
            where: { companyId },
          });
          if (!settings || (settings.whatsappEnabled && settings.sendOnAccepted)) {
            await notificationService.queueInvoiceMessage({
              companyId,
              invoiceId,
              template: WhatsappTemplate.INVOICE_SENT,
            });
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to auto-queue invoice_sent WhatsApp');
        }

        // Auto-alert on large invoices.
        try {
          const settings = await AppDataSource.getRepository(NotificationSettings).findOne({
            where: { companyId },
          });
          const threshold = Number(settings?.alertLargeInvoiceThreshold ?? 100000);
          if ((settings?.alertLargeInvoice ?? true) && Number(invoice.total) >= threshold) {
            await alertService.upsert({
              companyId,
              type: AlertType.LARGE_INVOICE,
              severity: AlertSeverity.INFO,
              title: `فاتورة كبيرة: ${invoice.invoiceNumber}`,
              message: `قيمة ${Number(invoice.total).toFixed(2)} ${invoice.currency} تتجاوز الحد.`,
              payload: { invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total) },
              invoiceId,
              dedupeKey: `large_invoice:${invoiceId}`,
            });
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to write large-invoice alert');
        }

        return { success: true, uuid: accepted.uuid, longId: accepted.longId, submissionId: response.submissionId };
      }

      // rejected path
      invoice.status = InvoiceStatus.REJECTED;
      invoice.etaErrors = JSON.stringify(rejected?.error ?? response);
      await AppDataSource.getRepository(Invoice).save(invoice);

      const logRepo = AppDataSource.getRepository(InvoiceLog);
      await logRepo.save(
        logRepo.create({
          invoiceId,
          action: InvoiceLogAction.ETA_REJECTED,
          meta: { errors: rejected?.error ?? response },
        }),
      );

      syncLog.status = EtaSyncStatus.FAILED;
      syncLog.errorMessage = JSON.stringify(rejected?.error ?? response);
      syncLog.response = response as unknown as Record<string, unknown>;
      await AppDataSource.getRepository(EtaSyncLog).save(syncLog);

      // Smart alert on rejection.
      try {
        await alertService.upsert({
          companyId,
          type: AlertType.INVOICE_REJECTED,
          severity: AlertSeverity.CRITICAL,
          title: `رفض من ETA: ${invoice.invoiceNumber}`,
          message: JSON.stringify(rejected?.error ?? response).slice(0, 500),
          payload: { invoiceNumber: invoice.invoiceNumber },
          invoiceId,
          dedupeKey: `invoice_rejected:${invoiceId}`,
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to write rejection alert');
      }

      return { success: false, errors: rejected?.error ?? response };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, invoiceId }, 'ETA submit threw');

      invoice.status = InvoiceStatus.REJECTED;
      invoice.etaErrors = msg;
      await AppDataSource.getRepository(Invoice).save(invoice);

      syncLog.status = EtaSyncStatus.FAILED;
      syncLog.errorMessage = msg;
      syncLog.attempts = (syncLog.attempts ?? 0) + 1;
      await AppDataSource.getRepository(EtaSyncLog).save(syncLog);

      throw err;
    }
  },

  /**
   * Download the official ETA PDF printout for a submitted document.
   * This is the same layout shown on the ETA portal ("Original" copy).
   */
  async getDocumentPrintout(companyId: string, uuid: string): Promise<Buffer> {
    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });

    if (!company.etaClientId || !company.etaClientSecret) {
      throw HttpError.badRequest('ETA credentials are not configured');
    }

    const token = await etaTokenService.getToken(companyId, {
      clientId: company.etaClientId,
      clientSecret: company.etaClientSecret,
      environment: company.etaEnvironment,
    });

    const res = await fetch(`${apiBaseUrl(company.etaEnvironment)}/api/v1/documents/${uuid}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ETA printout failed: ${res.status} ${text}`);
    }

    return Buffer.from(await res.arrayBuffer());
  },

  /**
   * Fetch invoice status by UUID from ETA.
   */
  async fetchInvoiceStatus(companyId: string, uuid: string) {
    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });

    if (!company.etaClientId || !company.etaClientSecret) {
      return { mock: true, status: 'Valid', uuid };
    }

    const token = await etaTokenService.getToken(companyId, {
      clientId: company.etaClientId,
      clientSecret: company.etaClientSecret,
      environment: company.etaEnvironment,
    });

    const res = await fetch(`${apiBaseUrl(company.etaEnvironment)}/api/v1/documents/${uuid}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`ETA fetch failed: ${res.status} ${await res.text()}`);
    return res.json();
  },
};
